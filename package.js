Package.describe({
  summary: "Azure blob upload",
  version: "1.0.0",
  git:"https://github.com/jamesfebin/azure-blob-upload"
});

Npm.depends({  
  'azure-storage': '0.3.3'
});


Package.onUse(function(api) {
  api.versionsFrom('METEOR@0.9.3.1');
  api.use(['ejson','underscore'],['client','server']);
  api.addFiles('azureupload.js');
  api.export(['AzureFile'],['client','server']);

});

Package.onTest(function(api) {
  api.use(['tinytest','ejson','underscore','coffescript'],['client','server']);
  api.use('jamesfebin:azure-blob-upload');
});
