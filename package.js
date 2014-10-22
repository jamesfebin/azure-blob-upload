Package.describe({
  summary: "Azure blob image upload",
  version: "1.0.0",
});

Package.onUse(function(api) {
  api.versionsFrom('METEOR@0.9.3.1');
  api.use(['ejson','underscore','coffeescript'],['client','server']);
  api.addFiles('azureupload.js');
  api.export(['AzureFile'],['client','server']);

});

Package.onTest(function(api) {
  api.use(['tinytest','ejson','underscore','coffescript'],['client','server']);
  api.use('jamesfebin:azure-blob-upload');
});
