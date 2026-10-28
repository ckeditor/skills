# The upload of the bundle

One signed `POST /editors` request uploads the bundle. The request sends the bundle file, the uploaded configuration, and the test data. This skill adds a script for this request, and the package scripts that run it.

Read these sections of the Cloud Services guides first (see `documentation-access.md`):

- The "Upload script" and "npm scripts" sections of the Vite guide: a complete upload script for Node.js, and the package scripts for the build and the upload.
- The "Uploading the editor bundle" and "Multi-root editor builds" sections of the main editor bundle guide: the fields of the request and the rules for the bundle version.
- The request signature guide and the API secret guide.

Use the script of the Vite guide as the model, and change it for the project.

## What the script sends

1. The bundle file, as a string.
2. The uploaded configuration from the shared module, with `cloudServices.bundleVersion` from the bundle version constant.
3. The `removePlugins` option with the plugins of `editorConfig.removePlugins` and of `pluginsRemovedOnServer`, as the check script does.
4. The test data from the test data file, without the final new line that a code editor adds.
5. `is_multi_root_editor: true` for a multi-root editor.

The configuration travels as JSON. The script converts the regular expressions of `htmlSupport` to strings, as `configuration-split.md` describes.

## The rules of the script

- **One editor definition.** The script reads the shared configuration, the bundle version, and `pluginsRemovedOnServer` from the shared module.
- **The credentials come from the environment.** The script reads the base URL of the REST API and the API secret from environment variables. The Vite guide uses the names `CKEDITOR_CS_API_BASE_URL` and `CKEDITOR_CS_API_SECRET`. Do not read the value of a secret, and do not print it.
- **The local file with the credentials stays out of the repository.** Add it to `.gitignore`, for example `.env.upload.local`. The `upload:bundle` script can read it with the `--env-file-if-exists` option of Node.js. The option is in Node.js 20.19 and later versions of Node.js 20, and in Node.js 22.9 and later. If the project supports an older version of Node.js, the upload script can call `process.loadEnvFile()` when the file exists.
- **The exit code reports the result.** The script prints the status and the message of the response. It exits with an error when the upload fails, so that a CI job fails too.
- **The script fits the project.** Write it in the language and the module format of the shared module (see step 3 of the workflow), so that it loads the shared module without a build step. In a monorepo, put it in the package that has the bundle build.
- **The script only sends the result of the build.** It does not change the bundle, the configuration, or the test data.

## The package scripts

Add three scripts to `package.json`, in every result of this skill:

1. `build:bundle` builds the bundle. It needs no credentials.
2. `upload:bundle` runs the upload script. It needs the credentials.
3. `release:bundle` runs `build:bundle`, the check script, and `upload:bundle`, in this order. Thus a bundle that fails the check does not go to Cloud Services. If the project has no check script, because the user did not want Playwright, `release:bundle` runs the build and the upload. Then tell the user to do the check steps before each upload.

Use the names of the "npm scripts" section of the Vite guide, or the names that the project uses for its other scripts. The `release:bundle` script of the Vite guide has no check, because the check script is in the test data guide.

## The CI setup

Give the user these steps for CI:

1. Run `build:bundle` and the check script on each change. These steps need no credentials.
2. Run `release:bundle` in a release job. Give the job the environment variables with the credentials, from the secrets of the CI system. The check in this job needs the browser of Playwright, and the `CKEDITOR_CHECK_LICENSE_KEY` license key if the editor has premium features.
3. Upload the bundle to each environment that the application uses, for example the test environment and the production environment. Each environment stores its own bundles.
4. Raise the bundle version for each change of the bundle or its configuration. A second upload of the same version fails with HTTP 409.
5. Upload the bundle before the application's deployment, as step 7 of the workflow describes.

## Before an upload

1. Run the check script first. It finds most problems without an upload.
2. Ask the user before an upload.
3. Use a test environment of Cloud Services for the first upload.

## After an upload

`GET /editors/{bundle_version}/config` returns the configuration that Cloud Services stores for a bundle version. Its `removePlugins` option shows the full list of plugins that Cloud Services removes. Compare this list with the list in the check script, and give the user the differences.
