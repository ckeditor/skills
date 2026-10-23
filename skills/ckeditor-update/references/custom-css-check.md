# Checking the custom styles

Step 5 compares the style inventory from step 1 with the editor CSS of the old and the new version. Step 6 compares the computed styles on a test page. Both are extra checks. They do not replace the guides.

The old version is the installed version from step 1. For a repair, it is the last version that worked (step 2), and you take the style inventory and the project CSS from the last working revision too.

## Get the editor CSS

- **The old version.** After the install, `node_modules` has only the new version. Download the old version of the packages below into a temporary directory outside the project. `npm pack` prints the name of the file that it creates. Extract each file into its own directory, because every package unpacks to the same `package/` directory:

	```bash
	npm pack <package>@<old-version>
	mkdir <directory> && tar -xzf <file>.tgz -C <directory>
	```

- **npm, CDN, and ZIP.** The CSS is `dist/ckeditor5.css` of `ckeditor5` and, if used, `dist/ckeditor5-premium-features.css` of `ckeditor5-premium-features`. For npm projects, the new files are in `node_modules`. For CDN and ZIP projects, they are in the temporary directory from step 5 item 7.
- **A legacy method.** A predefined build or a DLL build has its CSS in its `build/*.js` files. Other legacy methods have it in `dist/index.css` of the `@ckeditor/ckeditor5-*` packages, or, in older packages, in their `theme/` directories. If step 3 keeps the legacy method, read the new CSS from the same place in the new packages. If step 3 migrates, read it from `ckeditor5`.

## Compare the CSS files

Do this for each `--ck-*` variable that the project sets, in the old and the new CSS:

```bash
grep -n -- "--ck-<name>" <css-file>
```

The selector is above the match. The editor CSS can use native CSS nesting. Then read up from the match to the selector that is not indented, and join the nested selectors on the way. `&` stands for the outer selector.

- In `build/*.js`, all the CSS is on one very long line. Get only the rules:

	```bash
	grep -o '[^{}"]\{0,120\}{[^{}]*--ck-<name>[^{}]*}' build/<file>.js
	```

- In the `theme/` source files, a rule can read a variable through a PostCSS mixin. When a match is inside a `@define-mixin <name>` block, also search for `@mixin <name>`.

For each version, list the rules that read the variable: the selector and the property. When a match only sets another `--ck-*` variable, for example in a `:root` block, follow that variable until you reach a property, and list the end of the chain. The chain can be longer or shorter in the new version. Compare only the ends.

These differences are suspicious:

- A rule on the old list is not on the new list. The new list can also be empty.
- The new CSS sets the variable on a selector that is closer to the element than the selector of the project, for example on a `.ck-*` class when the project sets it on `:root`. Then the value of the editor wins.

For each `--ck-*` variable that the project reads, check that the new CSS still sets it. A variable that nothing sets gives an empty value without an error.

For each `.ck-*` selector in the style inventory, check that its classes are still in the new CSS. A missing class is only a hint, because a script can add a class that the CSS does not use. In step 6, look for the class in the DOM of the running editor.

## Compare the computed styles on a test page

This check needs no license key and no running editor. Make a plain HTML page in a temporary directory outside the project:

- Load the editor CSS and the project CSS in the same order as the app. For a predefined build or a DLL build, load its `build/*.js` file with a `<script>` element. The script adds its CSS to the page. Copy rules that are not in a plain stylesheet, for example Sass, Less, CSS modules, Vue scoped styles, Angular component styles, or CSS-in-JS, into a `<style>` element as plain CSS.
- Put the elements inside the same parent elements that the selectors of the project use.
- Turn off transitions and animations with `* { transition: none !important; animation: none !important; }`, so that you do not read a color in the middle of an animation.
- Add elements with the classes of the editor: the editing area, a button, an input, a toolbar, a balloon panel, and a `.ck-content` block with a paragraph, a block quote, a code block, and a table. Also add one element for each selector in the style inventory.
- Give the elements the states that the project styles, for example the `ck-focused`, `ck-on`, and `ck-disabled` classes. For `:focus`, call `element.focus()` in a script, check that `element.matches( ':focus' )` is true, and then read only that element.

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
3. Translate the value too, not only the name. For example, when a rule changed from `border` to `border-color`, the value `none` is not a valid color, and the browser draws the border in the text color. The nearest valid value is `transparent`, but the border still takes space.
4. If a guide offers a stylesheet that brings back the old look, tell the user. Using it is their choice, not yours.
