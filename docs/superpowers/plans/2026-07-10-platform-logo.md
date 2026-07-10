# Platform Logo Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Install the supplied SVG as the shared platform logo in the sidebar, Developer Guide, and browser favicon.

**Architecture:** Keep one unchanged copy in Vite's `public` directory so static HTML and React can reference the same stable `/qtp-logo.svg` URL. Render the asset with ordinary `<img>` elements and narrowly scoped CSS that preserves existing sidebar and documentation layouts.

**Tech Stack:** React 18, TypeScript, Vite 5, CSS, SVG, Ant Design 5

---

## File Map

- Create `frontend/public/qtp-logo.svg`: canonical copy of the supplied artwork.
- Modify `frontend/index.html`: declare the SVG favicon.
- Modify `frontend/src/QtpApp.tsx`: replace the generated sidebar badge.
- Modify `frontend/src/pages/DocsPage.tsx`: add the logo to Developer Guide branding.
- Modify `frontend/src/index.css`: size the sidebar and documentation logo images.

The working tree already contains unrelated edits in `QtpApp.tsx` and `index.css`. Preserve those edits and do not commit either shared file wholesale.

### Task 1: Install the canonical asset and favicon

**Files:**
- Create: `frontend/public/qtp-logo.svg`
- Modify: `frontend/index.html:4-8`

- [ ] **Step 1: Verify the asset and favicon references do not exist yet**

Run:

```bash
test ! -e frontend/public/qtp-logo.svg
rg -q 'rel="icon".*qtp-logo\.svg' frontend/index.html
```

Expected: the first command exits `0`; the second exits `1` because the favicon declaration is not present.

- [ ] **Step 2: Copy the supplied SVG without modifying it**

Run:

```bash
cp /home/bogdan/Downloads/qtp-logo.svg frontend/public/qtp-logo.svg
cmp /home/bogdan/Downloads/qtp-logo.svg frontend/public/qtp-logo.svg
```

Expected: `cmp` exits `0` with no output.

- [ ] **Step 3: Add the favicon declaration**

Add this line after the viewport meta tag in `frontend/index.html`:

```html
<link rel="icon" type="image/svg+xml" href="/qtp-logo.svg" />
```

- [ ] **Step 4: Verify the static integration**

Run:

```bash
test -s frontend/public/qtp-logo.svg
cmp /home/bogdan/Downloads/qtp-logo.svg frontend/public/qtp-logo.svg
rg -n 'rel="icon".*href="/qtp-logo\.svg"' frontend/index.html
```

Expected: all commands exit `0`, and `rg` prints the new favicon line.

### Task 2: Render the logo in platform branding

**Files:**
- Modify: `frontend/src/QtpApp.tsx:145-153`
- Modify: `frontend/src/pages/DocsPage.tsx:212`
- Modify: `frontend/src/index.css:116-146,411-415`

- [ ] **Step 1: Replace the sidebar badge with the shared image**

Change the branding markup in `QtpApp.tsx` to:

```tsx
<div className="qtp-logo">
  <img className="qtp-logo-mark" src="/qtp-logo.svg" alt="Quality Testing Platform" />
  {(isMobile || !collapsed) && (
    <span aria-hidden="true">
      <strong>Quality</strong>
      <small>Testing Platform</small>
    </span>
  )}
</div>
```

The image supplies the accessible platform name in collapsed mode; `aria-hidden` prevents the adjacent expanded text from being announced twice.

- [ ] **Step 2: Add the logo to Developer Guide branding**

Change the existing `qtp-docs-brand` element in `DocsPage.tsx` to:

```tsx
<div className="qtp-docs-brand" style={{ fontSize: '1.2rem', fontWeight: 600, marginBottom: '24px', color: token.colorText }}>
  <img className="qtp-docs-logo" src="/qtp-logo.svg" alt="" />
  <span>QTP Developer Guide</span>
</div>
```

The image is decorative here because the adjacent text already names the guide.

- [ ] **Step 3: Replace badge styling with image-safe dimensions**

Replace `.qtp-logo-mark` with:

```css
.qtp-logo-mark {
  display: block;
  width: 34px;
  height: 34px;
  object-fit: contain;
  flex-shrink: 0;
}
```

Extend documentation branding with:

```css
.qtp-docs-brand {
  display: flex;
  align-items: center;
  gap: 9px;
  font-weight: 750;
  margin-bottom: 16px;
}
.qtp-docs-logo {
  display: block;
  width: 28px;
  height: 28px;
  object-fit: contain;
  flex-shrink: 0;
}
```

- [ ] **Step 4: Confirm every visible placement uses the canonical URL**

Run:

```bash
rg -n 'qtp-logo\.svg' frontend/index.html frontend/src/QtpApp.tsx frontend/src/pages/DocsPage.tsx
rg -n 'qtp-logo-mark|qtp-docs-logo' frontend/src/index.css
```

Expected: the first command reports exactly the favicon, sidebar, and Developer Guide references; the second reports both image classes.

### Task 3: Build and verify responsive rendering

**Files:**
- Verify: `frontend/dist/index.html`
- Verify: `frontend/dist/qtp-logo.svg`

- [ ] **Step 1: Run the production build**

Run:

```bash
cd frontend
npm run build
```

Expected: TypeScript and Vite complete successfully and create `frontend/dist`.

- [ ] **Step 2: Verify Vite copied and referenced the asset**

Run from the repository root:

```bash
cmp frontend/public/qtp-logo.svg frontend/dist/qtp-logo.svg
rg -n 'qtp-logo\.svg' frontend/dist/index.html
```

Expected: `cmp` exits `0`; the built HTML contains `/qtp-logo.svg`.

- [ ] **Step 3: Start the local frontend**

Run:

```bash
cd frontend
npm run dev -- --host 127.0.0.1 --port 4173
```

Expected: Vite reports `http://127.0.0.1:4173/`. Keep this process running for the remaining checks.

- [ ] **Step 4: Verify the asset is served**

Run in another shell:

```bash
curl -fsS http://127.0.0.1:4173/qtp-logo.svg -o /tmp/qtp-logo-served.svg
cmp frontend/public/qtp-logo.svg /tmp/qtp-logo-served.svg
```

Expected: both commands exit `0`.

- [ ] **Step 5: Check the responsive and themed UI**

Open `http://127.0.0.1:4173/` and verify:

- Expanded desktop sidebar shows the complete logo without cropping beside the existing two-line name.
- Collapsed desktop sidebar remains 80 pixels wide and centers the logo without layout shift.
- Mobile navigation shows the same complete logo and text.
- Developer Docs shows the logo beside its title with baseline alignment.
- Sidebar and docs branding remain legible in light and dark themes.
- The browser tab displays the SVG favicon.

- [ ] **Step 6: Review the final diff without disturbing concurrent work**

Run:

```bash
git diff --check
git status --short
git diff -- frontend/index.html frontend/src/QtpApp.tsx frontend/src/pages/DocsPage.tsx frontend/src/index.css
```

Expected: `git diff --check` reports no whitespace errors. The diff includes the logo changes plus the pre-existing concurrent changes, all of which remain intact.

Do not create a code commit from this dirty shared worktree unless the user explicitly asks for one; committing the overlapping files would also capture unrelated work.
