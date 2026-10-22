# The samples and the test data

Cloud Services checks the bundle with the test data of the upload, and the comparison is exact. Read these sections of the test data guide of Cloud Services first (see `documentation-access.md`): "How the check works", "What to put in the test data", "Changes that the editor makes", and "Multi-root editors". This file has the steps for the project.

The test data must be the exact output of the editor. Test data that you write by hand almost always fails.

## Make the samples

Put the samples in the repository, for example in `test-data/samples/`, one HTML file for each topic. Use the list of the test data guide, and add this content:

- Every element and every attribute that the custom plugins read or write. Read the converters to find them: the view elements, classes, attributes, and the model attributes behind them.
- The old formats of the custom plugins that the application still stores. Keep these in the samples only, because the editor writes the current format.
- Content for the options of the shared configuration, for example all heading levels and all allowed elements of General HTML Support.
- Real documents of the application, if you have them. Do not put personal data in the repository.

If the editor has comments or track changes, take content with comment and suggestion markers from the application, with real comments and suggestions. The check of `verification.md` removes the markers before it compares, because it has no data of the comments. Its `--write` mode removes them too.

## Make the test data

1. Load each sample in the editor of the application, with its full runtime configuration. Then a content option that you left in the runtime configuration by mistake shows in the check of `verification.md`. Read "Take the output from the application" in `verification.md` for the ways to do this. If the editor of the application cannot start without a server, for example with real-time collaboration, use the `--write` mode of the check script, and read the runtime configuration again for options that change the content.
2. Take the output with `getData( { trim: 'none' } )`, the same call that Cloud Services uses.
3. Compare the output with the sample. Make sure that each change is correct, with the "Changes that the editor makes" section of the test data guide. If a change loses content, fix the plugin or the configuration, and do this step again.
4. Join the samples into one document, load it in the editor, and save its output as the test data, for example in `test-data/document.html`. Do not format the file. If the project has a code formatter, for example Prettier, add the test data folder to its ignore list. The upload must send the content without the final new line that code editors add.

The comparison in step 3 is necessary. A converter can lose data when it loads a document for the first time, and then give the same output on each next load. Test data from the editor output then contains the loss, and the upload passes. The "Example with a custom plugin" section of the test data guide shows such a case.

## Multi-root editors

The test data is a JSON string with each root of the editor. Make it with `JSON.stringify()`, for example `JSON.stringify( editor.getFullData( { trim: 'none' } ) )`. The upload request needs `is_multi_root_editor: true`. The "Multi-root editors" section of the test data guide has the rules and the errors.

## Update the test data

Make the test data again each time you change a plugin, the configuration, or the CKEditor 5 version. The output of the editor can change between versions.
