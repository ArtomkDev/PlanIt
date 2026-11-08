package __PACKAGE__.restorecredentials;

import android.app.Activity;
import android.content.Context;
import android.os.Build;

import androidx.annotation.NonNull;
import androidx.core.content.ContextCompat;
import androidx.credentials.ClearCredentialStateRequest;
import androidx.credentials.CreateCredentialResponse;
import androidx.credentials.CreateRestoreCredentialRequest;
import androidx.credentials.CreateRestoreCredentialResponse;
import androidx.credentials.Credential;
import androidx.credentials.CredentialManager;
import androidx.credentials.CredentialManagerCallback;
import androidx.credentials.GetCredentialRequest;
import androidx.credentials.GetCredentialResponse;
import androidx.credentials.GetRestoreCredentialOption;
import androidx.credentials.RestoreCredential;
import androidx.credentials.exceptions.ClearCredentialException;
import androidx.credentials.exceptions.CreateCredentialException;
import androidx.credentials.exceptions.CreateCredentialProviderConfigurationException;
import androidx.credentials.exceptions.CreateCredentialUnsupportedException;
import androidx.credentials.exceptions.GetCredentialException;
import androidx.credentials.exceptions.GetCredentialProviderConfigurationException;
import androidx.credentials.exceptions.GetCredentialUnsupportedException;
import androidx.credentials.exceptions.NoCredentialException;
import androidx.credentials.exceptions.restorecredential.E2eeUnavailableException;

import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;

import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.util.Collections;
import java.util.Map;
import java.util.concurrent.Executor;

public class RestoreCredentialsModule extends ReactContextBaseJavaModule {
    private static final String STATE_FILE = "planit_restore_credential_state.json";

    public RestoreCredentialsModule(ReactApplicationContext context) {
        super(context);
    }

    @Override
    public String getName() {
        return "RestoreCredentials";
    }

    private Context credentialContext() {
        Activity activity = getCurrentActivity();
        return activity != null ? activity : getReactApplicationContext();
    }

    private Executor mainExecutor() {
        return ContextCompat.getMainExecutor(getReactApplicationContext());
    }

    // noBackupFilesDir is never part of Auto Backup or device transfer, so the
    // state always describes this installation rather than a previous device.
    private File stateFile() {
        return new File(getReactApplicationContext().getNoBackupFilesDir(), STATE_FILE);
    }

    @Override
    public Map<String, Object> getConstants() {
        // Restore Credentials require Android 9; JavaScript skips every call below it.
        return Collections.singletonMap(
            "isSupported",
            Build.VERSION.SDK_INT >= Build.VERSION_CODES.P
        );
    }

    @ReactMethod
    public void readState(Promise promise) {
        File file = stateFile();
        if (!file.exists()) {
            promise.resolve(null);
            return;
        }
        try (InputStream input = new FileInputStream(file)) {
            ByteArrayOutputStream state = new ByteArrayOutputStream();
            byte[] buffer = new byte[1024];
            for (int read; (read = input.read(buffer)) != -1; ) state.write(buffer, 0, read);
            promise.resolve(new String(state.toByteArray(), StandardCharsets.UTF_8));
        } catch (IOException error) {
            promise.reject("RESTORE_STATE_UNAVAILABLE", error);
        }
    }

    @ReactMethod
    public void writeState(String state, Promise promise) {
        try (OutputStream output = new FileOutputStream(stateFile())) {
            output.write(state.getBytes(StandardCharsets.UTF_8));
            promise.resolve(null);
        } catch (IOException error) {
            promise.reject("RESTORE_STATE_UNAVAILABLE", error);
        }
    }

    @ReactMethod
    public void create(String requestJson, Promise promise) {
        create(requestJson, true, promise);
    }

    private void create(String requestJson, boolean cloudBackup, Promise promise) {
        CreateRestoreCredentialRequest request;
        try {
            request = new CreateRestoreCredentialRequest(requestJson, cloudBackup);
        } catch (IllegalArgumentException error) {
            promise.reject("RESTORE_CREDENTIAL_INVALID_REQUEST", error);
            return;
        }
        CredentialManager.create(getReactApplicationContext()).createCredentialAsync(
            credentialContext(),
            request,
            null,
            mainExecutor(),
            new CredentialManagerCallback<CreateCredentialResponse, CreateCredentialException>() {
                @Override
                public void onResult(CreateCredentialResponse response) {
                    if (response instanceof CreateRestoreCredentialResponse) {
                        promise.resolve(((CreateRestoreCredentialResponse) response).getResponseJson());
                    } else {
                        promise.reject("RESTORE_CREDENTIAL_UNEXPECTED_RESPONSE", response.getType());
                    }
                }

                @Override
                public void onError(@NonNull CreateCredentialException error) {
                    // Without cloud E2EE the key can still move by device-to-device transfer.
                    if (cloudBackup && error instanceof E2eeUnavailableException) {
                        create(requestJson, false, promise);
                    } else if (error instanceof CreateCredentialProviderConfigurationException
                        || error instanceof CreateCredentialUnsupportedException) {
                        promise.resolve(null);
                    } else {
                        promise.reject("RESTORE_CREDENTIAL_CREATE_FAILED", error.getType(), error);
                    }
                }
            }
        );
    }

    @ReactMethod
    public void get(String requestJson, Promise promise) {
        GetCredentialRequest request;
        try {
            request = new GetCredentialRequest.Builder()
                .addCredentialOption(new GetRestoreCredentialOption(requestJson))
                .build();
        } catch (IllegalArgumentException error) {
            promise.reject("RESTORE_CREDENTIAL_INVALID_REQUEST", error);
            return;
        }
        CredentialManager.create(getReactApplicationContext()).getCredentialAsync(
            credentialContext(),
            request,
            null,
            mainExecutor(),
            new CredentialManagerCallback<GetCredentialResponse, GetCredentialException>() {
                @Override
                public void onResult(GetCredentialResponse response) {
                    Credential credential = response.getCredential();
                    if (credential instanceof RestoreCredential) {
                        promise.resolve(((RestoreCredential) credential).getAuthenticationResponseJson());
                    } else {
                        promise.reject("RESTORE_CREDENTIAL_UNEXPECTED_RESPONSE", credential.getType());
                    }
                }

                @Override
                public void onError(@NonNull GetCredentialException error) {
                    if (error instanceof NoCredentialException
                        || error instanceof GetCredentialProviderConfigurationException
                        || error instanceof GetCredentialUnsupportedException) {
                        promise.resolve(null);
                    } else {
                        promise.reject("RESTORE_CREDENTIAL_GET_FAILED", error.getType(), error);
                    }
                }
            }
        );
    }

    @ReactMethod
    public void clear(Promise promise) {
        CredentialManager.create(getReactApplicationContext()).clearCredentialStateAsync(
            new ClearCredentialStateRequest(ClearCredentialStateRequest.TYPE_CLEAR_RESTORE_CREDENTIAL),
            null,
            mainExecutor(),
            new CredentialManagerCallback<Void, ClearCredentialException>() {
                @Override
                public void onResult(Void result) {
                    promise.resolve(null);
                }

                @Override
                public void onError(@NonNull ClearCredentialException error) {
                    promise.reject("RESTORE_CREDENTIAL_CLEAR_FAILED", error.getType(), error);
                }
            }
        );
    }
}
