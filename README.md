# VarSu

> CSS variable autocomplete with theme support 

```
We don’t hardcode tokens. We parse them.
We don’t assume theme logic. We infer it.
```

**VarSu** is a Language Server Protocol (LSP) it's built for **frontend developers**.  It enchances your workflow by making CSS variables simpler - with **autocompletion**, **calculation** and **theme awareness**.

---

## Features

- Autocompletion for `--css-vars`
- Theme-aware suggestions (`:root`, `[data-theme-dark]`, etc.)
- Value calculation support (e.g. `--x2 = calc(--x1 * 2)`)
- Deprecation warnings via `@deprecated`

## Support

| IDE | stage | 
| --- | --- |
| VS Code | ✅ done |
| Web Storm | 🛠️ in development |

## Setup

### 1. VS Code

...

## Usage

VarSu loads css file from URL and parses it. It supports multi-theming:

```css
:root {
  /** @deprecated use --main-color */
  --text-color: #000;

  /** @description primary used for texts */
  --main-color: #000;
}

[data-theme="dark"] {
  --main-color: #fff;
}
```

Just start typing var(-- — and VarSu will:

- Suggest available variables
- Show value previews and descriptions
- Warn you about deprecated entries

ℹ️ `@description` and `@deprecated` annotations are parsed only from the first theme block. Overrides are not supported yet.
