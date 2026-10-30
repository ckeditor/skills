# Checking the custom styles

Step 5 compares the style inventory from step 1 with the editor CSS of the old and the new version. Step 6 compares the computed styles on a test page. Both are extra checks. They do not replace the guides.

The old version is the installed version from step 1. For a repair, it is the last version that worked (step 2).

## Get the editor CSS

- **The old version.** After the install, `node_modules` has only the new version. Download the old version of the packages below with `npm pack` into a temporary directory outside the project. Extract each archive into its own directory, because all of them contain a `package/` directory.
- **npm, CDN, and ZIP.** The CSS is `dist/ckeditor5.css` of `ckeditor5` and, if used, `dist/ckeditor5-premium-features.css` of `ckeditor5-premium-features`. Check both files when the project uses premium features. For npm projects, the new files are in `node_modules`. For CDN and ZIP projects, they are in the temporary directory from step 5 item 7.
- **A legacy method.** A predefined build or a DLL build has its CSS inside the strings of its `build/*.js` files. There the CSS is minified into a few very long lines, and the build can also hold the `theme/` sources as strings. Take only the rule around each match, and skip the source strings. Other legacy methods have it in `dist/index.css` of the `@ckeditor/ckeditor5-*` packages, or, in older packages, in many files in their `theme/` directories. Read all these files together. If step 3 keeps the legacy method, read the new CSS from the same place in the new packages. If step 3 migrates, read it from `ckeditor5`.

## Find the rules that read a variable

Search all the CSS files of a version for the name of the variable. Old CSS can write `var( --name )` with spaces, and the matches also show where the editor sets the variable. For each read, write down the element and the property:

- The element is the full selector of the rule. The editor CSS can nest rules. Then read up from the match, and join the outer selectors on the way. `&` stands for the outer selector, and an `@media` block around a rule does not change the element. A selector can span several lines.
- When the match only sets another `--ck-*` variable, it is a link. Step 5 item 8 says when a link counts. Follow the chain until you reach a property. The chain can be longer or shorter in the new version.
- In the `theme/` source files of old versions, a rule can read a variable through a PostCSS mixin. Look for the `@define-mixin` block and the `@mixin` lines that use it.

For example, the old CSS has `.ck.ck-button:focus { border: var(--ck-a) }`. The new CSS has `.ck.ck-button:focus { border-color: var(--ck-b) }` and reads `--ck-a` only in other rules. `--ck-a` still exists, but it no longer changes the focused button, so the rule for the focused button is a finding.

Also check these:

- The new CSS sets the variable on a selector that is closer to the element than the selector of the project, for example on a `.ck-*` class when the project sets it on `:root`. Then the value of the editor wins.
- For each `--ck-*` variable that the project reads, the new CSS still sets it. A variable that nothing sets gives an empty value without an error.
- For each `.ck-*` selector in the style inventory, its classes are still in the new CSS. A missing class is only a hint, because a script can add a class that the CSS does not use. In step 6, look for the class in the DOM of the running editor.

## Compare the computed styles on a test page

This check needs no license key and no running editor. Make a plain HTML page in a temporary directory outside the project:

- Load the editor CSS and the project CSS in the same order as the app. For a predefined build or a DLL build, load its `build/*.js` file with a `<script>` element. The script adds its CSS to the page. Copy rules that are not in a plain stylesheet, for example Sass, Less, CSS modules, Vue scoped styles, Angular component styles, or CSS-in-JS, into a `<style>` element as plain CSS.
- Put the elements inside the same parent elements that the selectors of the project use.
- Turn off transitions and animations, so that you do not read a color in the middle of an animation.
- Add elements with the classes of the editor: the editing area, a button, an input, a toolbar, a balloon panel, and a `.ck-content` block with a paragraph, a block quote, a code block, and a table. Also add one element for each selector in the style inventory, and the element of each rule in the lists from step 5 item 8.
- Give the elements the states that the project styles or that the selectors of those rules name, for example the `ck-focused`, `ck-on`, and `ck-disabled` classes, `:focus`, or the sticky state of a toolbar. For `:focus`, focus the element in a script, check that it matches `:focus`, and then read only that element.

Read every longhand property of each element with `getComputedStyle()`, except the custom properties (`--*`). A value that only follows the size of the element or of its parent is not a finding, for example `width`, `inline-size`, `transform-origin`, or an `auto` margin. A shorthand such as `border` gives an empty string when its parts are different. Save each run to a file, and compare the files with a script.

Do four runs:

1. the old editor CSS without the project CSS,
2. the old editor CSS with the project CSS,
3. the new editor CSS without the project CSS,
4. the new editor CSS with the project CSS.

In runs 2 and 4, use the copy of the project CSS from step 1.

A difference matters when one of these is true:

- The project CSS changed the value in the old version (run 1 and run 2 are different), and the new version gives a different value with it (run 2 and run 4 are different). The setting of the project no longer works.
- The project CSS did not change the value in the old version (run 1 and run 2 are the same), but it changes it in the new version (run 3 and run 4 are different). The setting of the project now reaches more places.

The other differences are the new default look, and they are expected. Name them in the report as one expected change. Do not list each property.

Then do a fifth run: the new editor CSS with the project CSS after your changes. Use both rules again, with run 5 in place of run 4. If a difference still matters, fix it. If the new CSS cannot give the old value, or the user chose the new look, name the difference in the report.

The page does not cover `:hover`. In step 6, hover over each element that the project styles with `:hover` in the running editor, and check that the computed value is the value that the project sets. The page also covers only the elements on it. It does not replace the other checks of step 6.

## Fix a finding

1. Look for the change in the update guides of the range and in the pages that they link to. If a guide names the change, follow the guide.
2. If no guide names it, read the rule in the new CSS. It shows the variable or the selector that the new version uses. Change the project CSS to set it.
3. Restore only what the old setting did: set the new variable only for the property that the old rule set from the variable of the project. For example, when the old setting removed a focus border, do not remove the focus shadow too. Keep the old setting as long as the new CSS still reads it in some rules.
4. Translate the value too, not only the name. For example, when a rule changed from `border` to `border-color`, the value `none` is not a valid color, and the browser draws the border in the text color. The nearest valid value is `transparent`, but the border still takes space.
5. If a guide offers a stylesheet that brings back the old look, tell the user. Using it is their choice, not yours.
