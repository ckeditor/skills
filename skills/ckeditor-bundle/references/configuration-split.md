# Splitting the editor configuration

The upload sends the editor configuration to Cloud Services as JSON. `JSON.stringify()` removes functions and `undefined` values, and it turns DOM elements, class instances, and regular expressions into empty objects. Thus the configuration has two parts:

- **The shared configuration** is in the shared module. The application and the upload use it. It contains only JSON data.
- **The runtime configuration** is in the application. The application adds it to the shared configuration when it creates the editor.

Read the rules for the uploaded configuration in the "Editor configuration" section of the main editor bundle guide (see `documentation-access.md`).

## The shared configuration

Put these options in the shared configuration:

- Every option that changes the content or its conversion, for example the heading options, the link options, the options of images, tables, lists, and fonts, General HTML Support (`htmlSupport`), and the options of the custom plugins.
- `cloudServices.bundleVersion`. Cloud Services requires it. Read it from the bundle version constant of the shared module.
- The options that the application and Cloud Services must agree on, for example `removePlugins` of the application.
- Other plain JSON options of the editor, for example the toolbar, if this keeps the editor definition in one place. They do not change the content, so you can also keep them in the application.
- For a multi-root editor, the root attributes (`roots.<rootName>.modelAttributes`, or the legacy `rootsAttributes`) and the `label` and the `placeholder` of each root. Some versions of CKEditor 5 store the label and the placeholder in a root attribute of the model.

Regular expressions in `htmlSupport` are allowed in the shared module. The upload converts them to strings, for example `"/^(div|section)$/"`, because Cloud Services expects this format. Read the main guide for the current rule.

## The runtime configuration

Keep these values in the application:

- DOM elements, for example `attachTo`, `sidebar.container`, and `presenceList.container`. If the uploaded configuration must have such an option, set it to `null`. An empty object, from a DOM element after `JSON.stringify()`, can stop the upload.
- Functions and callbacks, for example `autosave.save`, upload adapters, and functions in the options of mentions.
- Classes, for example plugin classes in `extraPlugins` or in `comments.editorConfig.extraPlugins`.
- Credentials and URLs of the environment, for example `licenseKey`, `cloudServices.tokenUrl`, `cloudServices.webSocketUrl`, and the token URLs of other services. When the uploaded configuration has no license key, Cloud Services uses its own key for the bundle.
- Values of one session or one document, for example `collaboration.channelId` and the initial data.
- For a multi-root editor, the root elements and the initial data of each root, for example `roots.<rootName>.element` and `roots.<rootName>.initialData`. The root attributes are content, so they go in the shared configuration (see above).

## Content options that need a function

Some options change the content and contain a function, for example an automatic link decorator with a `callback`. The upload cannot send the function, so the bundle would give a different output. Move such an option into the code of the bundle:

1. Write a small plugin that defines the option in its constructor with `editor.config.define()`.
2. List the plugin in `builtinPlugins` of the shared class. The editor creates all plugins before it starts them, so the position in the list does not matter.
3. Remove the option from the runtime configuration, so that the application and the bundle use the same value.
4. Confirm the result with the check in `verification.md`. The samples must contain content that the option changes.

## Check the split

- Run `JSON.parse( JSON.stringify( sharedConfig ) )` and compare it with the shared configuration. The two must be equal, except for the regular expressions of `htmlSupport`.
- The shared module loads in Node.js without errors.
- The application gives the editor the shared configuration with the runtime configuration, and the editor works as before.
