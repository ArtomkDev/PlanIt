const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const babel = require('@babel/core');

const servicePath = path.resolve(
  __dirname,
  '../src/services/accountDeletionService.js',
);

const makeFirebaseFakes = ({
  firestoreDocuments = [],
  storageObjects = [],
  storageFailures = [],
  storageNotFound = [],
} = {}) => {
  const firestore = new Map(
    firestoreDocuments.map((entry) => [
      entry.path,
      entry.data || {},
    ]),
  );
  const storage = new Set(storageObjects);
  const failingStorageObjects = new Set(storageFailures);
  const missingStorageObjects = new Set(storageNotFound);

  const collection = (_db, ...segments) => ({
    kind: 'collection',
    path: segments.join('/'),
  });
  const doc = (_db, ...segments) => ({
    kind: 'document',
    path: segments.join('/'),
  });
  const limit = (count) => ({ kind: 'limit', count });
  const where = (field, operator, value) => ({
    kind: 'where',
    field,
    operator,
    value,
  });
  const query = (collectionReference, ...constraints) => ({
    collectionReference,
    constraints,
  });
  const getDocFromServer = async (reference) => ({
    exists: () => firestore.has(reference.path),
    data: () => firestore.get(reference.path),
  });

  const getDocsFromServer = async (queryReference) => {
    const collectionPath = queryReference.collectionReference.path;
    const collectionDepth = collectionPath.split('/').length;
    const whereConstraint = queryReference.constraints.find(
      (constraint) => constraint.kind === 'where',
    );
    const limitConstraint = queryReference.constraints.find(
      (constraint) => constraint.kind === 'limit',
    );

    const matches = Array.from(firestore.entries())
      .filter(([documentPath, data]) => {
        if (!documentPath.startsWith(`${collectionPath}/`)) return false;
        if (documentPath.split('/').length !== collectionDepth + 1) {
          return false;
        }
        if (!whereConstraint) return true;
        return (
          whereConstraint.operator === '==' &&
          data[whereConstraint.field] === whereConstraint.value
        );
      })
      .slice(0, limitConstraint?.count || Number.MAX_SAFE_INTEGER)
      .map(([documentPath]) => ({ ref: { path: documentPath } }));

    return {
      docs: matches,
      empty: matches.length === 0,
      size: matches.length,
    };
  };

  const writeBatch = () => {
    const deletions = [];
    return {
      delete(reference) {
        deletions.push(reference.path);
      },
      async commit() {
        deletions.forEach((documentPath) => firestore.delete(documentPath));
      },
    };
  };

  const deleteDoc = async (reference) => {
    firestore.delete(reference.path);
  };
  const serverTimestamp = () => ({ __serverTimestamp: true });
  const setDoc = async (reference, data) => {
    firestore.set(reference.path, data);
  };

  const storageRef = (_storage, objectPath) => ({ fullPath: objectPath });
  const listAll = async (prefixReference) => {
    const prefix = prefixReference.fullPath.replace(/\/+$/, '');
    const childPrefixes = new Set();
    const items = [];

    storage.forEach((objectPath) => {
      if (!objectPath.startsWith(`${prefix}/`)) return;
      const remainder = objectPath.slice(prefix.length + 1);
      const slashIndex = remainder.indexOf('/');
      if (slashIndex === -1) {
        items.push({ fullPath: objectPath });
      } else {
        childPrefixes.add(`${prefix}/${remainder.slice(0, slashIndex)}`);
      }
    });

    return {
      items,
      prefixes: Array.from(childPrefixes, (fullPath) => ({ fullPath })),
    };
  };
  const deleteObject = async (reference) => {
    if (missingStorageObjects.has(reference.fullPath)) {
      storage.delete(reference.fullPath);
      const error = new Error('Object not found.');
      error.code = 'storage/object-not-found';
      throw error;
    }
    if (failingStorageObjects.has(reference.fullPath)) {
      const error = new Error('Storage permission denied.');
      error.code = 'storage/unauthorized';
      throw error;
    }
    storage.delete(reference.fullPath);
  };

  return {
    state: { failingStorageObjects, firestore, storage },
    firestoreApi: {
      collection,
      deleteDoc,
      doc,
      getDocFromServer,
      getDocsFromServer,
      limit,
      query,
      serverTimestamp,
      setDoc,
      where,
      writeBatch,
    },
    storageApi: {
      deleteObject,
      listAll,
      ref: storageRef,
    },
  };
};

const loadService = (fakes) => {
  const source = fs.readFileSync(servicePath, 'utf8');
  const transformed = babel.transformSync(source, {
    filename: servicePath,
    plugins: ['@babel/plugin-transform-modules-commonjs'],
  }).code;
  const testModule = new Module(servicePath, module);
  testModule.filename = servicePath;
  testModule.paths = Module._nodeModulePaths(path.dirname(servicePath));

  const originalLoad = Module._load;
  Module._load = function mockedLoad(request, parent, isMain) {
    if (request === 'firebase/firestore') return fakes.firestoreApi;
    if (request === 'firebase/storage') return fakes.storageApi;
    if (request === '../config/firebase') {
      return { db: { name: 'test-db' }, storage: { name: 'test-storage' } };
    }
    return originalLoad.call(this, request, parent, isMain);
  };

  try {
    testModule._compile(transformed, servicePath);
    return testModule.exports;
  } finally {
    Module._load = originalLoad;
  }
};

test('deletes every known account resource in multiple batches', async () => {
  const userId = 'user-1';
  const firestoreDocuments = [
    { path: `users/${userId}` },
    { path: `users/${userId}/global/settings` },
    { path: `users/${userId}/notifications/n-1` },
    { path: `users/${userId}/devices/d-1` },
    {
      path: 'shared_schedules/OWNED',
      data: { ownerId: userId },
    },
    {
      path: 'shared_schedules/OTHER',
      data: { ownerId: 'another-user' },
    },
    { path: `schedules/${userId}` },
  ];
  for (let index = 0; index < 425; index += 1) {
    firestoreDocuments.push({
      path: `users/${userId}/schedules/s-${index}`,
    });
  }

  const missingObject =
    `users/${userId}/attachments/a-2/already-gone.pdf`;
  const fakes = makeFirebaseFakes({
    firestoreDocuments,
    storageObjects: [
      `users/${userId}/attachments/a-1/file.png`,
      missingObject,
    ],
    storageNotFound: [missingObject],
  });
  const { deleteAllUserCloudData } = loadService(fakes);

  const report = await deleteAllUserCloudData(userId);

  assert.equal(report.schedules, 425);
  assert.equal(report.globalDocuments, 1);
  assert.equal(report.sharedSchedules, 1);
  assert.equal(report.attachmentObjects, 2);
  assert.equal(report.deletionTombstone, 1);
  assert.equal(report.userDocument, 1);
  assert.equal(fakes.state.firestore.has(`users/${userId}`), false);
  assert.equal(
    Array.from(fakes.state.firestore.keys()).some((documentPath) =>
      documentPath.startsWith(`users/${userId}/`)
    ),
    false,
  );
  assert.equal(fakes.state.firestore.has('shared_schedules/OWNED'), false);
  assert.equal(fakes.state.firestore.has('shared_schedules/OTHER'), true);
  assert.equal(fakes.state.firestore.has(`schedules/${userId}`), false);
  assert.equal(
    fakes.state.firestore.has(`deleted_accounts/${userId}`),
    true,
  );
  assert.equal(fakes.state.storage.size, 0);
});

test('keeps the parent user document and reports storage failures', async () => {
  const userId = 'user-2';
  const failingObject =
    `users/${userId}/attachments/a-1/private.pdf`;
  const fakes = makeFirebaseFakes({
    firestoreDocuments: [
      { path: `users/${userId}` },
      { path: `users/${userId}/global/settings` },
      { path: `users/${userId}/schedules/s-1` },
    ],
    storageObjects: [failingObject],
    storageFailures: [failingObject],
  });
  const {
    AccountDataDeletionError,
    deleteAllUserCloudData,
  } = loadService(fakes);

  await assert.rejects(
    () => deleteAllUserCloudData(userId),
    (error) => {
      assert.equal(error instanceof AccountDataDeletionError, true);
      assert.equal(error.code, 'account-deletion/partial-failure');
      assert.deepEqual(error.failures, [
        {
          step: 'attachmentObjects',
          code: 'account-deletion/storage-delete-failed',
        },
      ]);
      return true;
    },
  );

  assert.equal(fakes.state.firestore.has(`users/${userId}`), true);
  assert.equal(
    fakes.state.firestore.has(`deleted_accounts/${userId}`),
    true,
  );
  assert.equal(
    fakes.state.firestore.has(`users/${userId}/global/settings`),
    false,
  );
  assert.equal(
    fakes.state.firestore.has(`users/${userId}/schedules/s-1`),
    false,
  );
  assert.equal(fakes.state.storage.has(failingObject), true);

  fakes.state.failingStorageObjects.delete(failingObject);
  const retryReport = await deleteAllUserCloudData(userId);
  assert.equal(retryReport.deletionTombstone, 1);
  assert.equal(retryReport.attachmentObjects, 1);
  assert.equal(fakes.state.firestore.has(`users/${userId}`), false);
  assert.equal(fakes.state.storage.has(failingObject), false);
});

test('rejects an empty user id before touching persistence', async () => {
  const fakes = makeFirebaseFakes();
  const { deleteAllUserCloudData } = loadService(fakes);

  await assert.rejects(
    () => deleteAllUserCloudData(''),
    (error) => error.code === 'account-deletion/invalid-user-id',
  );
  assert.equal(fakes.state.firestore.size, 0);
  assert.equal(fakes.state.storage.size, 0);
});
