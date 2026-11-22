/* Registry that lets the Cloud sync screen (rendered by js/cloud/boot.js after Firebase starts) live inside Settings
 * without Settings importing Firebase. boot.js sets cloudView.render; Settings calls it. */
export const cloudView = { render: null };
