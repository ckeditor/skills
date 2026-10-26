# The upload of the bundle

One signed `POST /editors` request uploads the bundle. The request sends the bundle file, the uploaded configuration, and the test data. This skill adds a script for this request, and the package scripts that run it.

Read these sections of the Cloud Services guides first (see `documentation-access.md`):

- The "Upload script" section of the Vite guide. It has a complete upload script for Node.js, with the signature of the request.
- The "npm scripts" section of the Vite guide. It has the package scripts for the build and the upload, and the error of a second upload.
- The "Uploading the editor bundle" section of the main editor bundle guide. It has the fields of the request and the rules for the bundle version.
- The "Multi-root editor builds" section of the main editor bundle guide, for a multi-root editor.
- The request signature guide, for the algorithm of the signature, and the API secret guide, for the secret.

Use the script of the Vite guide as the model, and change it for the project.

## What the script sends

1. The bundle file of the bundle build, as a string.
2. The uploaded configuration from the shared module, with `cloudServices.bundleVersion` from the bundle version constant.
3. The `removePlugins` option with the plugins of `editorConfig.removePlugins` and of `pluginsRemovedOnServer`. The check script of `verification.md` joins the two lists in the same way.
4. The test data from the test data file, without the final new line that a code editor adds.
5. `is_multi_root_editor: true` for a multi-root editor.

The configuration travels as JSON. The script converts the regular expressions of `htmlSupport` to strings, as `configuration-split.md` describes.

## The rules of the script

- **One editor definition.** The script reads the shared configuration, the bundle version, and `pluginsRemovedOnServer` from the shared module. A second copy of these values gives a different editor on the server.
- **The credentials come from the environment.** The script reads the base URL of the REST API and the API secret from environment variables. The Vite guide uses the names `CKEDITOR_CS_API_BASE_URL` and `CKEDITOR_CS_API_SECRET`. Keep the credentials out of the code, the logs, and the bundle. Do not read the value of a secret, and do not print it.
- **The local file with the credentials stays out of the repository.** Add it to `.gitignore`, for example `.env.upload.local`. The `upload:bundle` script can read it with the `--env-file-if-exists` option of Node.js 22.9 and later. If the project supports an older version of Node.js, the upload script can call `process.loadEnvFile()` when the file exists.
- **The exit code reports the result.** The script prints the status and the message of the response. It exits with an error when the upload fails, so that a CI job fails too.
- **The script fits the project.** Write it in the language and the module format of the shared module (see step 3 of the workflow). Then it loads the shared module without a build step. In a monorepo, put it in the package that has the bundle build.
- **The script only sends the result of the build.** It does not change the bundle, the configuration, or the test data.

## The package scripts

Add three scripts to `package.json`, in every result of this skill:

1. `build:bundle` builds the bundle. It needs no credentials.
2. `upload:bundle` runs the upload script. It needs the credentials.
3. `release:bundle` runs `build:bundle` and then `upload:bundle`.

Three scripts let CI build and check the bundle on each change, without the credentials. Use the names of the "npm scripts" section of the Vite guide, or the names that the project uses for its other scripts.

## The CI setup

Give the user these steps for CI:

1. Run `build:bundle` and the check of `verification.md` on each change. These steps need no credentials.
2. Run `upload:bundle` in a release job. Give the job the environment variables with the credentials, from the secrets of the CI system.
3. Upload the bundle to each environment that the application uses, for example the test environment and the production environment. Each environment stores its own bundles.
4. Raise the bundle version for each change of the bundle or its configuration. A second upload of the same version fails with HTTP 409.
5. Upload the bundle before the deployment of the application, as step 7 of the workflow describes.

## Before an upload

An upload stores the bundle version for good. Cloud Services does not replace a bundle and does not delete it. A failed upload stores nothing, so it leaves the bundle version free for the next try.

1. Run the check of `verification.md` first. It finds most problems without an upload.
2. Ask the user before an upload, and run it only with the approval of the user.
3. Use a test environment of Cloud Services for the first upload.
4. Read `troubleshooting.md` for a failed upload.

## After an upload

`GET /editors/{bundle_version}/config` returns the configuration that Cloud Services stores for a bundle version. Its `removePlugins` option shows the full list of the plugins that Cloud Services removes. Compare this list with the list in the check script of `verification.md`, and give the user the differences.
