import {
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
} from "firebase/firestore";
import {
  deleteObject,
  listAll,
  ref as storageRef,
} from "firebase/storage";
import { db, storage } from "../config/firebase";

const FIRESTORE_DELETE_BATCH_SIZE = 400;
const STORAGE_DELETE_CONCURRENCY = 20;
const STORAGE_VERIFICATION_PASSES = 3;

const getErrorCode = (error) => {
  if (typeof error?.code === "string" && error.code.trim()) {
    return error.code;
  }
  return "unknown";
};

const createStepError = (step, error) => ({
  step,
  code: getErrorCode(error),
});

export class AccountDataDeletionError extends Error {
  constructor(failures, report) {
    super("One or more account-data deletion steps failed.");
    this.name = "AccountDataDeletionError";
    this.code = "account-deletion/partial-failure";
    this.failures = failures;
    this.report = report;
  }
}

const deleteQueryInBatches = async (queryFactory) => {
  let deletedCount = 0;

  while (true) {
    const snapshot = await getDocsFromServer(queryFactory());
    if (snapshot.empty) {
      return deletedCount;
    }

    const batch = writeBatch(db);
    snapshot.docs.forEach((snapshotDoc) => {
      batch.delete(snapshotDoc.ref);
    });
    await batch.commit();
    deletedCount += snapshot.size;
  }
};

const deleteUserSubcollection = (userId, collectionName) =>
  deleteQueryInBatches(() =>
    query(
      collection(db, "users", userId, collectionName),
      limit(FIRESTORE_DELETE_BATCH_SIZE),
    ),
  );

const deleteOwnedShares = (userId) =>
  deleteQueryInBatches(() =>
    query(
      collection(db, "shared_schedules"),
      where("ownerId", "==", userId),
      limit(FIRESTORE_DELETE_BATCH_SIZE),
    ),
  );

const ensureDeletionTombstone = async (userId) => {
  const tombstoneReference = doc(db, "deleted_accounts", userId);
  const existingTombstone = await getDocFromServer(tombstoneReference);
  if (existingTombstone.exists()) {
    return 1;
  }

  try {
    await setDoc(tombstoneReference, {
      requestedAt: serverTimestamp(),
    });
  } catch (error) {
    // A concurrent deletion attempt may have created the immutable marker.
    const concurrentTombstone = await getDocFromServer(tombstoneReference);
    if (!concurrentTombstone.exists()) {
      throw error;
    }
  }

  return 1;
};

const collectStorageItems = async (rootReference) => {
  const pendingPrefixes = [rootReference];
  const items = [];

  while (pendingPrefixes.length > 0) {
    const prefix = pendingPrefixes.pop();
    const result = await listAll(prefix);
    items.push(...result.items);
    pendingPrefixes.push(...result.prefixes);
  }

  return items;
};

const deleteStorageItems = async (items) => {
  const failures = [];

  for (
    let offset = 0;
    offset < items.length;
    offset += STORAGE_DELETE_CONCURRENCY
  ) {
    const chunk = items.slice(offset, offset + STORAGE_DELETE_CONCURRENCY);
    const results = await Promise.allSettled(
      chunk.map((itemReference) => deleteObject(itemReference)),
    );

    results.forEach((result) => {
      if (
        result.status === "rejected" &&
        result.reason?.code !== "storage/object-not-found"
      ) {
        failures.push(result.reason);
      }
    });
  }

  if (failures.length > 0) {
    const error = new Error(
      `${failures.length} attachment object deletion(s) failed.`,
    );
    error.code = "account-deletion/storage-delete-failed";
    throw error;
  }
};

const deleteAttachmentStorage = async (userId) => {
  const rootReference = storageRef(
    storage,
    `users/${userId}/attachments`,
  );
  let deletedCount = 0;

  for (let pass = 0; pass < STORAGE_VERIFICATION_PASSES; pass += 1) {
    const items = await collectStorageItems(rootReference);
    if (items.length === 0) {
      return deletedCount;
    }

    await deleteStorageItems(items);
    deletedCount += items.length;
  }

  const remainingItems = await collectStorageItems(rootReference);
  if (remainingItems.length > 0) {
    const error = new Error(
      "Attachment storage was not empty after verification.",
    );
    error.code = "account-deletion/storage-not-empty";
    throw error;
  }

  return deletedCount;
};

/**
 * Deletes every known server-side resource owned by a Firebase user.
 *
 * The parent user document is deliberately deleted last. If any dependent
 * cleanup step fails, the parent and Firebase Auth user remain available so
 * the operation can be retried safely.
 */
export const deleteAllUserCloudData = async (userId) => {
  if (typeof userId !== "string" || !userId.trim()) {
    const error = new Error("A valid user id is required.");
    error.code = "account-deletion/invalid-user-id";
    throw error;
  }

  const report = {
    schedules: 0,
    notifications: 0,
    devices: 0,
    globalDocuments: 0,
    sharedSchedules: 0,
    legacyScheduleDocuments: 0,
    attachmentObjects: 0,
    deletionTombstone: 0,
    userDocument: 0,
  };
  const failures = [];

  try {
    report.deletionTombstone = await ensureDeletionTombstone(userId);
  } catch (error) {
    failures.push(createStepError("deletionTombstone", error));
    throw new AccountDataDeletionError(failures, report);
  }

  const dependentSteps = [
    {
      name: "schedules",
      run: () => deleteUserSubcollection(userId, "schedules"),
    },
    {
      name: "notifications",
      run: () => deleteUserSubcollection(userId, "notifications"),
    },
    {
      name: "devices",
      run: () => deleteUserSubcollection(userId, "devices"),
    },
    {
      name: "globalDocuments",
      run: () => deleteUserSubcollection(userId, "global"),
    },
    {
      name: "sharedSchedules",
      run: () => deleteOwnedShares(userId),
    },
    {
      name: "legacyScheduleDocuments",
      run: async () => {
        await deleteDoc(doc(db, "schedules", userId));
        return 1;
      },
    },
    {
      name: "attachmentObjects",
      run: () => deleteAttachmentStorage(userId),
    },
  ];

  for (const step of dependentSteps) {
    try {
      report[step.name] = await step.run();
    } catch (error) {
      failures.push(createStepError(step.name, error));
    }
  }

  if (failures.length > 0) {
    throw new AccountDataDeletionError(failures, report);
  }

  try {
    await deleteDoc(doc(db, "users", userId));
    report.userDocument = 1;
  } catch (error) {
    failures.push(createStepError("userDocument", error));
    throw new AccountDataDeletionError(failures, report);
  }

  return report;
};
