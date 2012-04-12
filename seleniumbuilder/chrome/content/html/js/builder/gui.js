// Establish gui namespace.
builder.gui = {};
builder.views = {};

/** The view being displayed. */
builder.gui.currentView = null;

builder.gui.switchView = function(newView) {
  if (builder.gui.currentView != null) {
    builder.gui.currentView.hide();
  }
  builder.gui.currentView = newView;
  builder.gui.currentView.show();
};

builder.registerPostLoadHook(function() {
  // Auto-resize the steps area.
  window.setInterval(function() {
  //  jQuery('#steplist').css('top', jQuery('#panels').top() + jQuery('#panels').height());
  }, 150);
  
  // Set the initial value of currenturl - this is necessary so that the startup-url field is
  // populated.
  builder.storage.set('currenturl', window.bridge.getRecordingWindow().document.location.toString());
});

// There is a bug in Firefox ( https://bugzilla.mozilla.org/show_bug.cgi?id=531199 ) that causes
// window.beforeunload to be called twice. So we set and reset this flag to prevent asking the user
// twice whether they want to close the window.
builder.gui.preventDoubleQuestion = false;

// Ask the user if they want to save changes.
window.onbeforeunload = function() {
  if (builder.gui.preventDoubleQuestion) { return; }
  if (builder.suite.getSaveRequired()) {
    builder.gui.preventDoubleQuestion = true;
    window.setTimeout(function() { builder.gui.preventDoubleQuestion = false; }, 2000);
    return "Any unsaved changes will be lost!";
  }
}

// If the recorder window is closed, shut down builder.
window.onunload = function() {
  window.bridge.recorderWindow = null; // As we're closing it ourselves just now, shutdown doesn't have to.
  window.bridge.shutdown();
};