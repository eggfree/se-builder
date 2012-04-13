/**
 * Dialog that can be inserted to allow the user to choose an URL to record an additional script
 * from.
 */
builder.dialogs.record = new(function () {
  /** The DOM node into which to insert the dialog, replacing its contents. */
  var node;
  
  return {
    /**
     * Insert a record dialog.
     * @param anode The DOM node into which to insert the dialog, replacing its contents.
     */
    show: function (anode) {
      node = anode;
      node.html('');
    
      node.append(newNode('form', {method:'get', action:'#record'},
          newNode('h4', {style:"font-weight: bold;"}, 'Start recording a new script at'),
          newNode('p',
              newNode('input', {id:'startup-url-2', type:'text', class:'texta', size:'24'}),
              newNode('p', {},
                newNode('input', {type:'submit', value:'Record new Se 1', class:'button',
                  click:function(e) {
                    builder.record.startRecording(jQuery("#startup-url-2").val(), builder.selenium1);
                    node.html('');
                    builder.gui.menu.updateRunSuiteOnRC();
                  }}),
                newNode('input', {type:'submit', value:'Record new Webdriver', class:'button',
                  click:function(e) {
                    builder.record.startRecording(jQuery("#startup-url-2").val(), builder.selenium2);
                    node.html('');
                    builder.gui.menu.updateRunSuiteOnRC();
                  }}),
                newNode('a', 'Cancel', {
                    class: 'button',
                    click: function () {
                      node.html('');
                    },
                    href: '#cancel'
                })
              ),
              newNode('p', {class:'cookie-warning'},
                "This will delete all cookies for the domain you're recording for."
              )
          )
      ));
      var v = builder.storage.get('currenturl');
      jQuery('#startup-url-2').val(v);  
    },
    hide: function () {
      node.html('');
    }
  }
})();
