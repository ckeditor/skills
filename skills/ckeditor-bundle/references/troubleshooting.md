# Troubleshooting the bundle

## Upload errors

The Cloud Services guides list the upload errors with their causes and fixes (see `documentation-access.md`). Cloud Services can change a message between its versions, so look up each message in the current guides:

- The "Troubleshooting" section of the Vite guide has the errors of the bundle file, the configuration, the plugins, the bundle version, and the request. It also names the connection error of the collaboration sessions.
- The test data guide has the errors of the test data, in its "How the check works", "Changes that the editor makes", "Multi-root editors", and "Other validation errors" sections.

To find the cause of a failed upload:

1. Read the HTTP status and the message of the response.
2. Find the message in the guides.
3. If the test data failed, compare the `data.convertedData` field of the response with the test data. This field contains the editor output on the server.

Some errors point to a decision of this skill:

- `plugincollection-required`: a kept plugin requires a removed plugin. Read the class 2 and class 3 sections of `plugin-classification.md`.
- `plugincollection-plugin-not-found`: the shared configuration has the `plugins` or `extraPlugins` option. Remove it, and list all plugins in `builtinPlugins`.
- An error about a DOM element, for example `sidebar-setcontainer-invalid-element`: the shared configuration has a runtime value. Read `configuration-split.md`.
- Test data that fails: read `test-data.md`. If the output loses the content of a custom plugin, the plugin can be in the wrong class, or a content option is missing in the shared configuration.

## The local check and the build

- `The editor changes the test data at character …` (the check of `verification.md`). The check runs the bundle without the plugins that Cloud Services must not run. If the test data comes from the full editor, a removed plugin changes the data. Read "Confirm each decision" in `plugin-classification.md`. If the test data comes from the application, a content option can also be missing in the shared configuration.
- `The bundle does not set the CKEditorCS global to the editor class.` (the check of `verification.md`). The bundle is an ES module, the global has another name, the global is an object with exports, or the bundle stops while it loads, for example with `process is not defined`. The message also shows the page errors. Fix the bundle build.
- `The editor did not start: plugincollection-required …` (the check). If `requiredBy` is an official plugin, for example `RealTimeCollaborativeComments`, it requires a plugin that Cloud Services removes, and Cloud Services removes it too. Add it to the list of plugins that Cloud Services removes in the check. If `requiredBy` is a custom plugin, a kept plugin requires a removed plugin. Read the class 2 and class 3 sections of `plugin-classification.md`.
- `The editor did not start: …` (the check). Read the error code. A license error means that the editor uses premium features and the check has no license key, or a key for another distribution channel. Set a key for self-hosted installations in `CKEDITOR_CHECK_LICENSE_KEY`.
- `The editor is read-only.` (the check). A license error or another error came after the editor started. The page errors are in the message.
- `The test data is not the output of JSON.stringify()` (the check, for a multi-root editor). The test data is formatted JSON or JSON from another encoder. Make it with `JSON.stringify()`.
- `TypeError: domDocument.createElement is not a function` in Node.js. The shared module imports `ckeditor5` or a module that imports it. Move the editor class to its own module, and keep the shared configuration free of browser code.
- The build of the application fails after the change. The application still imports the plugins or the editor in the old way, or the server-side rendering runs the editor code. Keep the editor code on the client only.
