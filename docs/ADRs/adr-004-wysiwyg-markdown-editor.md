# ADR-004: WYSIWYG Markdown Editor Library

<div style="border-left: 4px solid #2563eb; background: #e9f1fb; padding: 1em 1.2em; margin: 1.5em 0; border-radius: 6px; color: #1a1a1a;">
  <span style="color:#2563eb; font-weight:bold;">&#8505; Note to self:</span>
  <div style="margin-top:0.4em;">
    This ADR was ai-generated. I reviewed the options but didn't research in much details different md editor options.
  </div>
</div>


>**What:** Library choice for implementing WYSIWYG (What You See Is What You Get) markdown editor in the frontend  
>**Status:** Decided  
>**Date:** 2025-01-XX  
>**Outcome:** Using TipTap with markdown extension for WYSIWYG markdown editing

## Requirements

- Replace dual-pane markdown editor (separate input and preview) with WYSIWYG editor
- Real-time rendering of markdown formatting as user types (e.g., `_italic_` appears as italic text)
- Support for basic markdown features:
  - Basic formatting (bold, italic, inline code)
  - Headings (H1-H6)
  - Lists (ordered and unordered)
  - Links
  - Blockquotes
- React/TypeScript integration
- Maintain existing functionality (autosave, editing workflow)
- Good developer experience and documentation
- Reasonable bundle size

## Options considered

### considered and immediately rejected

- **React-Markdown-Editor-Lite / SimpleMDE:**
  - Not true WYSIWYG (still shows markdown syntax)
  - Less modern architecture
  - Limited customization options
  - Some projects are less actively maintained

- **CKEditor 5:**
  - Commercial license required for advanced features
  - Larger bundle size
  - More complex setup
  - Overkill for simple markdown editing needs

- **TinyMCE / Froala:**
  - Primarily HTML editors, not markdown-focused
  - Commercial licensing for advanced features
  - Larger bundle sizes

### potentials

- TipTap
- MDXEditor
- Slate.js

## TipTap

**What it is:** TipTap is a headless, framework-agnostic rich text editor built on top of ProseMirror. It provides a modular, extensible architecture with excellent React and TypeScript support.

Pros:
- **Built on ProseMirror** - Stable, battle-tested foundation used by many production applications
- **Modular architecture** - Install only the extensions you need, keeping bundle size manageable
- **Excellent TypeScript support** - Full type safety and IntelliSense
- **Active community and documentation** - Large community, comprehensive docs, and many examples
- **Markdown extension available** - Official extension for markdown input/output support
- **Highly customizable** - Easy to extend with custom functionality
- **Good performance** - Efficient rendering and updates
- **MIT license** - Free and open source
- **React integration** - First-class React support with hooks API

Cons:
- **Learning curve** - Some complexity for advanced customization
- **Bundle size can grow** - With many extensions, bundle size increases (but modular approach helps)
- **Markdown setup required** - Need to configure markdown extension (not built-in by default)

**Bundle size:** ~50-100KB (core), varies with extensions

## MDXEditor

**What it is:** MDXEditor is a markdown-first WYSIWYG editor built specifically for React, with built-in markdown parsing and rendering.

Pros:
- **Markdown-first design** - Built specifically for markdown editing
- **Built-in markdown support** - Markdown parsing/rendering included out of the box
- **Good WYSIWYG experience** - Designed for seamless markdown editing
- **MDX support** - Can handle JSX in markdown if needed in future
- **Modern React hooks API** - Clean, React-friendly interface
- **Good documentation** - Well-documented with examples
- **MIT license** - Free and open source

Cons:
- **Smaller community** - Less community support and fewer examples compared to TipTap
- **Less flexible** - More focused on markdown, less suitable for other rich text use cases
- **Newer project** - Less battle-tested in production environments

**Bundle size:** ~80-120KB

## Slate.js

**What it is:** Slate.js is a highly customizable, framework-agnostic rich text editor framework. It provides a low-level API for building custom editors.

Pros:
- **Highly customizable** - Full control over editor behavior and structure
- **Framework-agnostic core** - Works with React, Vue, and other frameworks
- **Complete flexibility** - Can implement exactly the behavior you want
- **MIT license** - Free and open source

Cons:
- **Steeper learning curve** - More complex to understand and implement
- **More boilerplate required** - Need to build more functionality yourself
- **No built-in markdown support** - Would need to implement markdown parsing/rendering from scratch
- **Requires significant setup time** - More development effort to get started
- **Smaller community** - Less community support and fewer resources

**Bundle size:** ~40-60KB (core), but requires building more functionality yourself

## Conclusion

**Decision:** Using TipTap with the markdown extension.

**Rationale:**

1. **Best balance of features and maintainability** - TipTap provides the right combination of features, community support, and ease of use for this project
2. **Strong TypeScript support** - Excellent type safety aligns with the project's TypeScript setup
3. **Active ecosystem** - Large community and extensive documentation make it easier to find solutions and examples
4. **Modular approach** - Can install only needed extensions, keeping bundle size reasonable
5. **ProseMirror foundation** - Built on a stable, battle-tested foundation used in production by many applications
6. **Markdown extension available** - Official extension provides the markdown functionality needed
7. **Future flexibility** - If requirements change, TipTap's extensibility allows for easy adaptation

While MDXEditor was a strong alternative with its markdown-first approach, TipTap's larger ecosystem, better documentation, and more battle-tested foundation make it the better choice for long-term maintainability.

The implementation will replace the current dual-pane editor (`MarkdownEditor` and `MarkdownPreview` components) with a single TipTap-based WYSIWYG editor component that renders markdown formatting in real-time as the user types.

