# Sorting the custom plugins

Cloud Services runs the bundle in a browser on the server. Nobody uses the editor UI there, the uploaded configuration has no DOM elements, and Cloud Services blocks the network requests of the editor during document conversions. The application is not there either, so its globals and its server do not exist.

A custom plugin is every plugin that does not come from `ckeditor5` or `ckeditor5-premium-features`. This includes the plugins of other npm packages. Read all the code of each custom plugin, also the classes that it requires and the modules that it imports. Then put it in one of the four classes below.

Decide from the code, not from the name of the plugin. A plugin with "UI" in its name can register a converter, and a plugin with "Editing" in its name can send requests.

## 1. Data plugins: keep them in the bundle

A plugin defines data when it changes what the editor stores or how it converts content. Signals in the code:

- `editor.model.schema.register()`, `schema.extend()`, `schema.addAttributeCheck()`, or `schema.addChildCheck()`.
- `editor.conversion.for( … )` with `upcast`, `downcast`, `dataDowncast`, or `editingDowncast`, `conversion.elementToElement()`, `attributeToAttribute()`, and the other conversion helpers. Listeners on the upcast or downcast dispatchers.
- `editor.model.document.registerPostFixer()`.
- Changes of the data pipeline, for example listeners on `editor.data` events, a custom data processor, or the configuration of General HTML Support from the code.
- Markers that go into the data, for example `markerToData()`.

Keep these plugins in `builtinPlugins`, and never remove them on the server. The plugins that they require stay too.

## 2. Browser-only plugins: Cloud Services removes them

A plugin serves only the browser when removing it does not change the data. It has no schema, no conversion, no post-fixer, and no change of the data pipeline. Such a plugin must not run on the server if it needs something that only the browser has:

- Requests to a server: `fetch`, `XMLHttpRequest`, `WebSocket`, `navigator.sendBeacon`, analytics, or loading of external scripts, fonts, or images.
- DOM elements outside the editor, for example an element from the configuration or from `document.querySelector()`.
- The globals of the application, browser storage, or configuration options that exist only in the runtime configuration.

Keep these plugins in `builtinPlugins`, so that the application and the bundle have the same class. Add their names to the list of plugins that Cloud Services must not run, in the shared module. The upload sends this list as `removePlugins`.

A plugin that only registers CKEditor UI components, for example a button with `editor.ui.componentFactory.add()`, and needs nothing else, works on the server. You can keep it, so that you change less code. If you are not sure, remove it on the server, because a removed plugin that defines no data cannot change the output.

Before you remove a plugin, make sure that no kept plugin requires it. Search for the plugin in the `requires` lists. If a kept plugin requires it, the result depends on `builtinPlugins`:

- If `builtinPlugins` lists the removed plugin, Cloud Services also removes each plugin that requires it, without an error. Then a data plugin can disappear, and only the test data shows the problem.
- If `builtinPlugins` does not list the removed plugin, for example because it lists only a glue plugin, the upload stops with the `plugincollection-required` error.

The Server-side Editor API does not use the `removePlugins` option of the upload. Its scripts run every plugin of the bundle, unless the request lists them in `plugins_to_remove`. The editor scripts guide of Cloud Services describes this parameter (see `documentation-access.md`). Thus make each browser-only plugin do nothing when its runtime options are not there, and tell the user about `plugins_to_remove`.

If the UI part imports a UI library, for example React, or large assets, you can keep it out of the bundle. Then the application adds it with the `extraPlugins` option of the runtime configuration, and the shared class does not list it. Explain this choice in the report, because the bundle then differs from the editor of the application.

## 3. Plugins that do both: split them

One plugin can define data and also have a part that needs the browser: requests, DOM elements outside the editor, globals of the application, or a UI library. Split it:

1. An editing part with the schema, the converters, the post-fixers, and the commands.
2. A UI part with the components and the requests. The UI part requires the editing part.

List both parts in `builtinPlugins`, and add the UI part to the list of plugins that Cloud Services must not run. Do not list a glue plugin that requires both parts, because it would require a removed plugin. If the application or other code uses the glue plugin, change it to use the two parts. The inline widget tutorial of the CKEditor 5 docs shows this split (see `documentation-access.md`).

Keep the public API of the plugin: the command names, the configuration options, and the names that other code uses. Do not change the data format.

If the only other part of the plugin registers CKEditor UI components and needs nothing from the list above, the plugin works on the server as it is. Do not split it. Put it in class 1.

## 4. Plugins that need special care

The data part of a plugin can need something that does not exist on the server. Signals in the schema, the converters, the post-fixers, and the code that runs in `init()` or `afterInit()`:

- DOM elements outside the editor: `document.querySelector()`, `getElementById()`, or an element from the configuration.
- The globals of the application: `window.myApp`, a store, a router, or a framework context.
- Network requests, for example a converter that loads data for an element.
- Browser storage, cookies, or timers that change the content later.
- Configuration options that exist only in the runtime configuration, such as callbacks or DOM elements.
- Dates, numbers, or text that depend on the locale or the time zone of the computer, for example `Intl.DateTimeFormat` without a fixed `timeZone`. The server can have another locale and time zone, and then it writes other content.

Change the data part so that it works without them:

- Read the values from the uploaded configuration, which is JSON. Give the options a default value. Put the locale and the time zone in the configuration too.
- Store the data that the output needs in the model, for example in attributes, and do not load it during conversion.
- Make DOM elements and callbacks optional. If an option is not there, skip the work.
- Move the requests and the timers to the UI part.

If you cannot change the plugin without a change of its data format, stop and ask the user.

## Plugin names

Cloud Services removes plugins by their `pluginName`. Give each custom plugin a static `pluginName` with a fixed string. Do not take the name from the class name, because the bundler can rename classes when it minifies the code.

Make sure that no official plugin has the same name, also in `ckeditor5-premium-features`. For example, the official footnotes feature has the plugins `Footnotes`, `FootnotesEditing`, and `FootnotesUI`. `removePlugins` removes every plugin with the name, and an editor cannot load two plugins with the same name. If a custom plugin has the name of an official plugin, tell the user. A new name changes the code of the application, so do not rename it without approval.

## The official plugins

Cloud Services removes some official plugins itself, for example the real-time collaboration plugins and `Autosave`. You do not need to add them to the list. The `GET /editors/{bundle_version}/config` request shows the full list for an uploaded bundle (see `documentation-access.md`). The list depends on the version of Cloud Services.

## Confirm each decision

The check in `verification.md` runs the bundle without the plugins that Cloud Services must not run, and compares the output with the test data from the full editor. If the output is different, a removed plugin changes the data, so it belongs in class 1 or 3. Make sure that the samples use every element and attribute of each custom plugin, so that the check can find such a mistake.
