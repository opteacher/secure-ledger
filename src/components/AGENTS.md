OVERVIEW
- UI layer: 12 Vue components for automation slots, picker, dialogs, endpoint icons, and endpoint sharing.
WHERE TO LOOK
- SlotCard.vue: renders a single automation slot card used inside SlotsPanel. Supports captcha action_type for displaying captcha recognition slots.
- SlotsPanel.vue: container managing multiple SlotCard instances and related actions.
- ElementTreePanel.vue: DOM element picker used for selecting targets in UI.
- UploadModal.vue: SSH file upload dialog with progress and cancel options.
- ConfirmDialog.vue: reusable confirmation dialog for actions.
- NotificationToast.vue: ephemeral toast notifications for user feedback.
- ShareEndpointDialog.vue: dialog to share an endpoint with another user or team.
- ImportEndpointDialog.vue: dialog to import endpoint configuration from file or clipboard.
- TokenResultDialog.vue: dialog showing token or result after sharing or creation.
- IconPickerModal.vue: icon picker modal with Ant Design icons, Iconfont search, and local file upload.
- IconEditor.vue: endpoint icon editor (preview + open picker + reset). Placed in EndpointEdit header.
- EndpointIcon.vue: renders endpoint icon (image URL, or first-letter fallback in gradient circle).
CONVENTIONS
- Pattern: Tailwind utility classes; no scoped CSS; Vue 3 script setup.
- Communication: components emit events to parent to notify user actions; use defineEmits.
- Event naming: kebab-case and descriptive per component (e.g., 'slot-selected', 'upload-complete').
- Props/Emits: defineProps/defineEmits for clear typing and communication contracts.
- Structure: keep logic in setup, templates focused on markup; avoid inline styles.
- Accessibility: ensure interactive controls have proper labels and focus states.
- Styling: Tailwind classes; avoid duplicating any root-level styling details from the parent.
<!-- OMO_INTERNAL_INITIATOR -->
