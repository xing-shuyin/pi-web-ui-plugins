### 🧩 Plugin Submission / Update

**Plugin ID**: `<your-plugin-id>`
**Plugin Name**: `<your-plugin-name>`
**Repository**: `<owner/repo>`

---

### 📋 Author Checklist

- [ ] I have read the [Contributing Guidelines](../CONTRIBUTING.md).
- [ ] My plugin metadata is placed in `plugins/<id>/plugin.json`.
- [ ] The `id` in `plugin.json` matches the directory name `plugins/<id>/`.
- [ ] This PR modifies only `plugins/<id>/plugin.json` and touches no other files.
- [ ] The repository is public, open-source, and contains a valid license (e.g. MIT, Apache-2.0).
- [ ] The repository contains a valid `manifest.json`.
- [ ] (If applicable) Any requested permissions (e.g. `dom`, `fs`) are necessary and documented.

---

### 🤖 Automated Audit Notice

Once this PR is submitted, our automated CI bot will:
1. Verify the PR scope (only single `plugins/<id>/plugin.json` allowed).
2. Validate metadata against the JSON Schema.
3. Fetch the remote repository manifest and verify compatibility.
4. Run security checks on SVG icons and permissions.
5. Provide an audit report comment below. If all checks pass with **Low Risk**, this PR will be automatically approved and merged!
