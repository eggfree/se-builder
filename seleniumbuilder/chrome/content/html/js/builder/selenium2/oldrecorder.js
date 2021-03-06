/**
 * A class that can record clicks and typing on a window and all sub-windows. This version is
 * for recording Selenium 2 scripts.
 *
 * @param {Window} target_window The window to monitor
 * @param {Function(method, params)} A callback to be called when an event is detected
 *
 * @return {
 *    destroy: Function()  Removes the event listeners from all sub-windows
 * }
 *
 * @depends builder.locator
 */
builder.sel2.Recorder = function (target_window, record_action) {
  /**
   * List of frames to which the recorder has been bound. Gets continually updated via timeout.
   */
  var bound = [];

  /**
   * Create an event from a received click on any element.
   */
  function writeJsonClicks(e) {
    var params = builder.locator.create(e.target);
    if (isTypeOrClickInSamePlace(builder.getScript().getLastStep(), params)) {
      if (e.type == 'dblclick' &&
          { 'clickElement': 1, 'clickElementWithOffset': 1, 'doubleClickElement': 1 }[builder.getScript().getLastStep().type])
      {
        builder.getScript().getLastStep().changeType('doubleClickElement');
        builder.stepdisplay.update();
      }
      return;
    }

    // Selects are handled via change events, so clicks on them can be ignored.
    if ({ 'select': true, 'option': true }[e.target.tagName.toLowerCase()]) {
      return;
    }

    if (e.type == 'dblclick') {
      record_action('doubleClickElement', params);
    } else if (e.target.type == "checkbox") {
      if (jQuery(e.target).attr('checked')) {
        record_action('setElementSelected', params);
      } else {
        record_action('setElementNotSelected', params);
      }
    } else {
      if (e.target.type == "submit") {
        // If we click on a submit element, submit the form.
        record_action('submitElement', params);
      } else {
        record_action('clickElement', params);
      }
    }
  }

  /**
   * Return true if the given step is a type/click step with the same locator as the given params.
   */
  function isTypeOrClickInSamePlace(step, params) {
    if (params && step && { "sendKeysToElement": 1, "clickElement": 1, "doubleClickElement": 1, "setElementSelected": 1 }[step.type])
    {
      var loc2 = builder.sel2.extractSel2Locator(params);
      for (var i = 0; i < builder.loc_type_1_2.length; i++) {
        var type = builder.loc_type_1_2[i][1];
        if (step.locator.alternatives) {
          if (step.locator.alternatives[type] && loc2.alternatives[type] &&
              step.locator.alternatives[type] == loc2.alternatives[type])
          {
            return true;
          }
        } else {
          if (step.locator.type == type && step.locator.value == loc2.alternatives[type]) {
            return true;
          }
        }
      }
      return false;
    } else {
      return false;
    }
  }

  /** Record change events, e.g. typing, selecting, radio buttons. */
  function writeJsonChange(e) {
    var params = builder.locator.create(e.target);
    var step = builder.getScript().getLastStep();
    var prevStep =
      builder.getScript().steps.length >= 2
        ? builder.getScript().steps[builder.getScript().steps - 2]
        : null;
    
    // Under some circumstances, for example when the user presses an arrow key, an event can
    // be triggered in Firefox with no e.target.type. Ignore these. 
    if (!e.target.type) {
      return;
    }
    
    // Typing
    if ({ "textarea": 1, "text": 1, "password": 1 }[e.target.type.toLowerCase()]) {
      // Continue typing or replace a click with a type.
      if (isTypeOrClickInSamePlace(step, params)) {
        step.changeType("sendKeysToElement");
        step.text = e.target.value;
        builder.stepdisplay.update();
        return;
      }
      // Also need to check for previous step in case of using enter to submit forms -
      // otherwise we get a spurious extra "type" step after the submit click step.
      if (isTypeOrClickInSamePlace(prevStep, params)) {
        prevStep.changeType("sendKeysToElement");
        prevStep.text = e.target.value;
        builder.stepdisplay.update();
        return;
      }

      // Start typing
      params.text = e.target.value;
      // Check if this is FF re-submitting text that's already been entered. This happens if the
      // user presses enter to submit a form while focus is on an input field.
      var script = builder.getScript();
      if (script.steps.length >= 2) {
        if (script.steps[script.steps.length - 1].type == "submitElement" &&
            script.steps[script.steps.length - 2].type == "sendKeysToElement" &&
            script.steps[script.steps.length - 2].text == params.text)
        {
          return;
        }
      }
      record_action("sendKeysToElement", params);
      return;
    }
    
    // Selecting
    if (e.target.type.toLowerCase() == 'select' || e.target.type.toLowerCase() == 'select-one') {
      record_action("setElementSelected", params);
      var newStep = builder.getScript().getLastStep();      
      if (newStep.locator.alternatives["xpath"]) {
        newStep.locator = {
          "alternatives": {},
          "type": "xpath",
          "value": newStep.locator.alternatives.xpath + "/option[" + (e.target.selectedIndex + 1) + "]"
        };
      } else if (newStep.locator.alternatives["id"]) {
        newStep.locator = {
          "alternatives": {},
          "type": "id",
          "value": "//*[@id='" + newStep.locator.alternatives.id + "']/option[" + (e.target.selectedIndex + 1) + "]"
        };
      }
      builder.stepdisplay.update();
      return;
    }
    
    if (e.target.type.toLowerCase() == 'select-multiple') {
      var currentVal = jQuery(e.target).val();
      var oldVal = e.target.__sb_oldVal || [];
      for (var c = 0; c < currentVal.length; c++) {
        var newlyAdded = true;
        for (var o = 0; o < oldVal.length; o++) {
          if (currentVal[c] == oldVal[o]) {
            newlyAdded = false;
          }
        }
        if (newlyAdded) {
          record_action("setElementSelected", params);
          var newStep = builder.getScript().getLastStep();
          if (newStep.locator.alternatives["xpath"]) {
            newStep.locator = {
              "alternatives": {},
              "type": "xpath",
              "value": newStep.locator.alternatives.xpath + "/option[normalize-space(.)='" + builder.normalizeWhitespace(currentVal[c]) + "']"
            };
          } else if (newStep.locator.alternatives["id"]) {
            newStep.locator = {
              "alternatives": {},
              "type": "id",
              "value": "//*[@id='" + newStep.locator.alternatives.id + "']/option[normalize-space(.)='" + builder.normalizeWhitespace(currentVal[c]) + "']"
            };
          }
        }
      }
      for (var o = 0; o < oldVal.length; o++) {
        var stillThere = false;
        for (var c = 0; c < currentVal.length; c++) {
          if (currentVal[c] == oldVal[o]) {
            stillThere = true;
          }
        }
        if (!stillThere) {
          record_action("setElementNotSelected", params);
          var newStep = builder.getScript().getLastStep();
          if (newStep.locator.alternatives["xpath"]) {
            newStep.locator = {
              "alternatives": {},
              "type": "xpath",
              "value": newStep.locator.alternatives.xpath + "/option[normalize-space(.)='" + builder.normalizeWhitespace(oldVal[o]) + "']"
            };
          } else if (newStep.locator.alternatives["id"]) {
            newStep.locator = {
              "alternatives": {},
              "type": "id",
              "value": "//*[@id='" + newStep.locator.alternatives.id + "']/option[normalize-space(.)='" + builder.normalizeWhitespace(oldVal[o]) + "']"
            };
          }
        }
      }
      e.target.__sb_oldVal = currentVal;
      builder.stepdisplay.update();
    }
    
    // Radio button
    if (e.target.type == 'radio') {
      // Replace a click with a radio button check
      if (isTypeOrClickInSamePlace(step, params)) {
        step.changeType("setElementSelected");
        step.locator = builder.sel2.extractSel2Locator(params);
        builder.stepdisplay.update();
        return;
      }

      // Add radio button check
      record_action("setElementSelected", params);
      return;
    }
  }

  /** Finds the frame for a given document. */
  function findFrame(d) {
    for (i in bound) {
      if (bound[i].document == d) {
        return bound[i];
      }
    }
    return null;
  }

  /**
   * This is horrendously primitive support for typing at new-school HTML fun-stuff
   * It will approximately work for appending stuff but monitoring changes is nigh impossible.
   * However it has the advantage of providing the selectors needed for closer modification.
   */
  function writeJsonType(e) {
    var lastStep = builder.getScript().getLastStep();
    if (lastStep.type == "sendKeysToElement") {
      if (e.which >= 32 || e.which == 9 || e.which == 10) {
       lastStep.text += String.fromCharCode(e.which);
      } else if (e.which == 8) {
        lastStep.text = lastStep.text.substr(lastStep.text - 1);
      }
      builder.stepdisplay.update();
    } else {
      var params = builder.locator.create(e.target);
      if (e.which >= 32 || e.which == 9 || e.which == 10) {
        params.value = String.fromCharCode(e.which);
      }
      record_action('sendKeysToElement', params);
    }
  }

  /**
   * Record exact position of clicks for elements where it might be important (e.g canvas tags).
   */
  function writeJsonClickAt(e) {
    var params = builder.locator.create(e.target);
    var offset = jQuery(e.target).offset();
    params.coordString = (e.clientX - offset.left) + "," + (e.clientY - offset.top);

    // To keep from generating multiple actions for the same click, update the previous click 
    // step as necessary. 
    var locator = params._default;
    var locValue = params[locator];
    if ((lastLocValue == locValue) && (lastLocator == locator)) {
      if (e.type == 'click') {
        return;
      }
      if (e.type == 'dblclick' && { "clickElement":1, "clickAt":1 }[builder.lastStep().method()]) {
        builder.getScript().getLastStep().changeType("doubleClickElement");
        builder.stepdisplay.update();
        return;
      }
    }
    lastLocValue = locValue;
    lastLocator = locator;
    clearTimeout(lastLocTimeout);
    // If the clicks happen more than a second apart we count them separately.
    lastLocTimeout = setTimeout(function () {
      lastLocValue = null;
      lastLocator = null;
    }, 1000);

    record_action("clickElementWithOffset", params);
  }

  /**
   * Attempt to catch enter keys as they often trigger events.
   * However, the browser often uses them to trigger clicks, in which case we want to record the
   * click.
   */
  // qqDPS Not needed for Selenium 2?
   /*
  function writeJsonKeyPress(e) {
    var lastStep = builder.getScript().getLastStep();
    if (e.which == 13) { // 13 is the key code for enter
      var previousId = lastStep ? lastStep.id : null;
      // If the keypress is used to trigger a click, this key event will be immediately
      // followed by a click event. Hence, wait 100 ms and check if another step got recorded
      // in the meantime.
      setTimeout(function () {
        var step = builder.getScript().getLastStep();
        if (!step ||
            step.id == previousId ||
            step.type != "clickElement" ||
            e.target.nodeName.toLowerCase() == 'textbox')
        {
          // Ignore enter keypresses on select and option elements.
          if ({'select': true, 'option': true}[e.target.nodeName.toLowerCase()]) {
            return;
          }
          params = builder.locator.create(e.target);
          params.text = "\\13";
          record_action("sendKeysToElement", params);
        }
      }, 100);
    }
  }*/

  /**
   * Given a function and a recording function, returns a new function that first executes the 
   * original function and then calls the recording function, passing in the Observer function,
   * the arguments and the return value. The original wrapped function is put into the 
   * __original__ field of the returned function. In short, it interposes the record function as
   * a logger.
   * @param original The function to wrap.
   * @param observer The observer function to wrap it in.
   */
  function wrapWithObserver(original, observer) {
    if (typeof original != 'function') { // FIXME - there should be better handling of this.
      return original;
    }

    // If the original function is already wrapped, unwrap it before adding the new wrapping. 
    if (typeof original.__original__ == 'function') {
      original = original.__original__;
    }

    function replacement() {
      var ret = original.apply(this, arguments);
      observer(this, arguments, ret);
      return ret;
    }
    
    replacement.__original__ = original;
    return replacement;
  }

  /**
   * Attach an observer function to the given field of the given object.
   * @param object The object to one of whose fields we want to attach an observer
   * @param fieldName The name of the field
   * @param The observer function 
   */
  function observe(object, fieldName, observer) {
    if (object && object[fieldName]) {
      object[fieldName] = new wrapWithObserver(object[fieldName], observer);
    }
  }

  /**
   * Detach observers from the given object's fields.
   * @param object The object to detach observers from
   * @param fieldNames___ All arguments beyond the 1st are the names of the fields to unobserve
   */
  function unobserve(object, fieldNames___) {
    for (var i = 1; i < arguments.length; i++) {
      var fieldName = arguments[i];
      if (object && object[fieldName] && object[fieldName].__original__) {
        object[fieldName] = object[fieldName].__original__;
      }
    }
  }

  // qqDPS Alert handling not yet implemented for Sel 2.
  // FIXME: if possible this should be hooked in at a chrome level to avoid 
  // splattering messily if a web-app overrides the alert function.
  // event DOMWillOpenModalDialog doesn't seem to give enough information.
  /**
   * Attach observers to the alert, prompt, and confirm dialog functions to record the fact that
   * the test runner will have to wait for and then deal with the dialog. 
   */
  function overrideDialogs(frame) {
    observe(frame.wrappedJSObject, 'alert', function (thiz, args, retval) {
      record_action("waitForAlert", { 'equal to': args[0] });
    });
    observe(frame.wrappedJSObject, 'prompt', function (thiz, args, retval) {
      record_action("answerOnNextPrompt", { 'answer': retval });
      builder.reorderLastSteps(); // qqDPS
      // Necessary: Selenium raises an error if a second alert/prompt/confirmation occurs
      // before this gets called.
      record_action("verifyPrompt", { 'equal to': args[0] }); 
    });
    observe(frame.wrappedJSObject, 'confirm', function (thiz, args, retval) {
      if (retval) {
        record_action("chooseOkOnNextConfirmation", {});
      } else {
        record_action("chooseCancelOnNextConfirmation", {});
      }
      builder.reorderLastSteps();
      record_action("verifyConfirmation", { 'equal to': args[0] });
    });
  }

  /** Remove observers for dialogs. */
  function underrideDialogs(frame) {
    unobserve(frame.wrappedJSObject, 'alert', 'prompt', 'confirm');
  }

  /**
   * Attaches listeners to everything in the frame.
   * @param frame The frame to attach listeners to.
   * @param level The level of the frame - level 0 means it's a page in the browser
   */
  function bindFrame(frame, level) {
    // Remember that this frame has been bound to.
    bound.push(frame);
        
    // Turns out there are cases where people are canceling click on purpose, so I am manually
    // going to attach click listeners to all links.
    var links = frame.document.getElementsByTagName('a');
    for (var i = 0; i < links.length; i++) {
      jQuery(links[i]).bind("click", {}, writeJsonClicks, true);
      for (var z = 0; z < links[i].childNodes.length; z++) {
        jQuery(links[i].childNodes[z]).bind("click", {}, writeJsonClicks, true);
      }
    }

    overrideDialogs(frame);

    jQuery('canvas').
        bind('click', {}, writeJsonClickAt, true).
        bind('keypress', {}, writeJsonType, true);

    jQuery(frame.document).
        bind("dblclick", {}, writeJsonClicks, true).
        bind("keyup", {}, writeJsonChange, true).
        bind("change", {}, writeJsonChange, true)


    if (frame.document.designMode && frame.document.designMode.toLowerCase() == 'on') {
      jQuery(frame.document).
          bind("keypress", {}, writeJsonType, true).
          bind("click", {}, writeJsonClickAt, true);
    } else {
      jQuery(frame.document).
          bind("click", {}, writeJsonClicks, true);/*.
          bind("keypress", {}, writeJsonKeyPress, true);*/
    }

    // Turn off autocomplete.
    deactivateAutocomplete(frame.document.getElementsByTagName('form'));
    deactivateAutocomplete(frame.document.getElementsByTagName('input'));
    deactivateAutocomplete(frame.document.getElementsByTagName('textarea'));
  }

  /** Turns off autocomplete for the given fields. */
  function deactivateAutocomplete(elements) {
    for (var i = 0; i < elements.length; i++) {
      jQuery(elements[i]).attr("autocomplete", "off");
    }
  }
  
  /** Reactivate autocomplete for the given elements. */
  function reactivateAutocomplete(elements) {
    for (var i = 0; i < elements.length; i++) {
      jQuery(elements[i]).removeAttr("autocomplete");
    }
  }

  /**
   * Remove all the listeners from everything in the frame.
   */
  function unbindFrame(frame, level) {
    if (!frame.document) { return; }
    
    var links = frame.document.getElementsByTagName('a');
    for (var i = 0; i < links.length; i++) {
      jQuery(links[i]).unbind("click", writeJsonClicks, true);
      for (var z = 0; z < links[i].childNodes.length; z++) {
        jQuery(links[i].childNodes[z]).unbind("click", writeJsonClicks, true);
      }
    }

    underrideDialogs(frame);
    
    jQuery('canvas').
        unbind('click', writeJsonClickAt, true).
        unbind('keypress', writeJsonType, true);
    
    jQuery(frame.document).unbind("dblclick", writeJsonClicks, true);
    
    jQuery(frame.document).
        unbind("keyup", writeJsonChange, true).
        unbind("change", writeJsonChange, true);
    
    if (frame.document.designMode && frame.document.designMode.toLowerCase() == 'on') {
      jQuery(frame.document).
          unbind("keypress", writeJsonType, true).
          unbind("click", writeJsonClickAt, true);
    } else {
      jQuery(frame.document).
          unbind("click", writeJsonClicks, true);/*.
          unbind("keypress", writeJsonKeyPress, true);*/
    }

    // Turn autocomplete back on. Unfortunately, this also turns on autocomplete for elements
    // that had autocomplete off in the original document. Theoretically speaking, the original
    // autocomplete value could be stored in deactivateAutocomplete and restored here, but in
    // practice, Firefox pretends to Javascript that the attribute doesn't exist! For example,
    // the line
    // <input autocomplete="off" type="text" name="email"></input></p>
    // turns into
    // <input name="email" type="text"></p>
    // when read in from jQuery.
    reactivateAutocomplete(frame.document.getElementsByTagName('form'));
    reactivateAutocomplete(frame.document.getElementsByTagName('input'));
    reactivateAutocomplete(frame.document.getElementsByTagName('textarea'));
  }

  /**
   * Add listeners into common navigation functions.
   */
  function bind_browser(browser) {
    // Firefox 3.5 Only
    observe(browser, 'BrowserBack', function () {
      if (browser.content == window.bridge.getRecordingWindow()) { record_action('goBack', {}); }
    });

    // The other BrowserReload* functions are just wrappers around this
    observe(browser, 'BrowserReloadWithFlags', function () {
      if (browser.content == window.bridge.getRecordingWindow()) { record_action('refresh', {}); }
    });

    // Listen for the user actually typing in a URL into the navigation bar.
    // (browser is a window, gBrowser is a Browser, and mCurrentBrowser is a TabBrowser)
    observe(browser.gBrowser.mCurrentBrowser, 'loadURIWithFlags', function (browser, url) {
      // We can't find out what the URL was until after we get destroyed (and then bound to
      // the next content window) so we rely on who ever is listening to do this for us.
      record_action('open', {}, /* user opened page manually*/ true);
    });
  }

  /**
   * Remove listeners from common navigation functions.
   */
  function unbind_browser(browser) {
    unobserve(browser, 'BrowserBack', 'BrowserReloadWithFlags');
    unobserve(browser.gBrowser.mCurrentBrowser, 'loadURIWithFlags');
  }

  // Initialise the recorder by binding to all frames in the recorder window.
  builder.loadlistener.on_all_frames(target_window, bindFrame, 0);
  // Periodically check if new frames have appeared.
  var checkFrames = setInterval(function () {
    builder.loadlistener.on_all_frames(target_window, function (frame, level) {
      if (bound.indexOf(frame) == -1) {
        bindFrame(frame, level);
      }
    }, 0);
  }, 200);
  
  // Now listen on navigation functions in the browser.
  bind_browser(window.bridge.getBrowser());
  
  return {
    /** Turns off the recorder. */
    destroy: function () {
      builder.loadlistener.on_all_frames(target_window, unbindFrame, 0);
      clearInterval(checkFrames);
      unbind_browser(window.bridge.getBrowser());
    }
  };
};