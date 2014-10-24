Azure-Blob-Upload
=========

This package allows you to upload your files to azure blob storage. Thanks to the eventminded file upload tutorial. I just extended their code .




Version
----

1.0



Usage
--------------

```sh

Add this in your client side

files = document.getElementById('fileUpload');
file = files.files[0]

 AzureFile.upload(file,"uploadFile",{/*Pass some Parameters here */},function(err,success)
 {
                                if (err)
                                        throw err
                                else
                                    //file upload was succesfull
 }
 
 Add this in your server side

Meteor Server 

 Meteor.methods({
  'uploadFile': function(file) {
  
  /* Remember the method name must match the method name from the client call. The parameters passed from the client can be referenced by file.paramname */
    var response;
    if (file === void 0) {
      throw new Meteor.Error(500, "Missing File", "", "");
    }
    response = file.azureUpload(file.name, "Account Name", "Account Key", "Container Name");
    return console.log(response);
    /* Once file is completely uploaded you get a url in the response . Remember the file is uploaded in chunks so this function will be triggered multiple times. The response will contain the url parameter only if the file is completely uploaded */
  }
});

```


> You can support this package here 
> https://gratipay.com/heyfebin/






