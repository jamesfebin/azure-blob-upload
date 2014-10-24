function defaultZero(value){
	return _.isUndefined(value) ? 0 : value;
}
AzureFile = function (options) {
  options = options || {};
  this.name = options.name;
  this.type = options.type;
  this.size = options.size;
  this.data = options.data;
  this.start = defaultZero(options.start);
  this.end = defaultZero(options.end);
  this.bytesRead = defaultZero(options.bytesRead);
  this.bytesUploaded = defaultZero(options.bytesUploaded);
  this.blockCount = options.blockCount || 0;
  this.blockArray = options.blockArray || [];
  this._id = options._id || Meteor.uuid();
};

AzureFile.fromJSONValue = function (value) {
  return new AzureFile({
    name: value.name,
    type: value.type,
    size: value.size,
    data: EJSON.fromJSONValue(value.data),
    start: value.start,
    end: value.end,
    bytesRead:value.bytesRead,
    bytesUploaded:value.bytesUploaded,
    _id:value._id,
    blockCount:value.blockCount,
    blockArray:value.blockArray
  });
};

AzureFile.prototype = {
  constructor: AzureFile,

  typeName: function () {
    return "AzureFile";
  },

  equals: function (other) {
    return other._id == this._id
  },

  clone: function () {
    return new AzureFile({
      name: this.name,
      type: this.type,
      size: this.size,
      data: this.data,
      start: this.start,
      end: this.end,
      bytesRead:this.bytesRead,
      bytesUploaded:this.bytesUploaded,
      _id:this._id,
      blockCount:this.blockCount,
      blockArray:this.blockArray
    });
  },

  toJSONValue: function () {
    return {
      name: this.name,
      type: this.type,
      size: this.size,
      data: EJSON.toJSONValue(this.data),
      start: this.start,
      end: this.end,
      bytesRead:this.bytesRead,
      bytesUploaded:this.bytesUploaded,
      _id:this._id,
      blockId:this.blockId,
      blockCount:this.blockCount,
      blockArray:this.blockArray
    };
  }
};

EJSON.addType("AzureFile", AzureFile.fromJSONValue);

if (Meteor.isClient) {
  _.extend(AzureFile.prototype, {
    read: function (file,options, callback) {
      
    	if(arguments.length == 2)
    		callback = options;

     options = options || {};

      var reader = new FileReader;
      var self = this;
      var chunkSize = 512 * 512; 

      callback = callback || function () {};

      self.size = file.size;
      self.start = self.end;
      self.end += chunkSize;

      if (self.end > self.size)
      	self.end += chunkSize;


      reader.onload = function () {
      	self.bytesRead += self.end - self.start;
		self.data = new Uint8Array(reader.result);
	    callback(null, self);

      };

      reader.onerror = function () {
        callback & callback(reader.error);

      };

      if ((this.end - this.start) > 0)
      {
      	var blob = file.slice(self.start , self.end);
      	reader.readAsArrayBuffer(blob);
      }

      return this;
    },
    rewind: function ()
    {
    	this.data = null;
    	this.start = 0;
    	this.end = 0;
    	this.bytesRead = 0;
    	this.bytesUploaded = 0;
    	this.blockCount = 0;
    	this.blockArray = [];
    },
    upload: function(file,method,options,callback){
    	var self = this;

    	if(!Blob.prototype.isPrototypeOf(file))
    		throw new Meteor.Error("First parameter must inherit from Blob");
    	if(!_.isString(method))
    		throw new Meteor.Error("Sencond parameter must be a method");

    	if(arguments.length< 4 && _.isFunction(options))
    	{
    		callback = options;
    		options = {};
    	}
    	 Session.set("fileProgress",0);


    	options = options || {};

    	self.rewind();
    	self.size = file.size;
    	var readNext = function(){

    		if(self.bytesUploaded < self.size){
    			self.read(file, options, function(err,res)
    			{
    				if (err){
    					self.rewind();
    					callback && callback(err);
    				}
    					
    				else
    				{
    					self.blockArray.push(btoa("BlockNo" + self.blockCount));
    				Meteor.apply(
    					method,
    					[self].concat(options.params || []),
    					{
    						wait:true
    					},
    					function(err)
    					{
    						
    						if (err){
    							self.rewind();
    							callback && callback(err)
    						}
    						else {
    							self.bytesUploaded += self.data.length;
    							 
    							Session.set('fileProgress',((self.bytesUploaded/self.size)*100));
    							self.blockCount ++;
    							readNext();
    						}

    					}
    					);
    				}
    			});

    		}else{

    			callback && callback(null,self);

    		}

    	};
    	readNext();
    	return this;
    	

    }
  });

  _.extend(AzureFile, {
    read: function (file, callback) {
      return new AzureFile(file).read(file, options, callback);
    },
    upload: function (file,method,options,callback){

    	return new AzureFile(file).upload(file,method,options,callback);

    }
  });
}
if (Meteor.isServer) {
  var fs = Npm.require('fs'),
  path = Npm.require('path'),
  azure = Npm.require('azure-storage'),
  stream = Npm.require('stream'),
  util = Npm.require('util');
  

var ReadableStreamBuffer = function(fileBuffer) {
    var that = this;
    stream.Stream.call(this);
    this.readable = true;
    this.writable = false;
 
    var frequency = 50;
    var chunkSize = 1024;
    var size = fileBuffer.length;
    var position = 0;
 
    var buffer = new Buffer(fileBuffer.length);
    fileBuffer.copy(buffer);
 
    var sendData = function() {
        if(size === 0) {
            that.emit("end");
            return;
        }

        var amount = Math.min(chunkSize, size);
        var chunk = null;
        chunk = new Buffer(amount);
        buffer.copy(chunk, 0, position, position + amount);
            position += amount;
        size -= amount;
        
        that.emit("data", chunk);
    };
 
    this.size = function() {
        return size; 
    };
 
    this.maxSize = function() {
        return buffer.length;
    };
 
    this.pause = function() {
        if(sendData) {
            clearInterval(sendData.interval);
            delete sendData.interval;
        }
    };
 
    this.resume = function() {
        if(sendData && !sendData.interval) {
            sendData.interval = setInterval(sendData, frequency);
        }
    };
 
    this.destroy = function() {
        that.emit("end");
        clearTimeout(sendData.interval);
        sendData = null;
        that.readable = false;
        that.emit("close");
    };
 
    this.setEncoding = function(_encoding) {
    };
 
    this.resume();
};
util.inherits(ReadableStreamBuffer, stream.Stream);



  function sanatize(fileName){
  	if (fileName === void 0)
       return;
    else
  		return fileName.replace(/\//g,'').replace(/\.\.+/g,'.');
  }

    blobService = azure.createBlobService("boutstorage", "JtCAsptXFWdtys9/onQul7R/WP51c2JAxyFDB9/Ualn6wESJ0bbCQeeJWyDInIEUZCNXWJ+sQEweexOm86j6WA==").withFilter(retryOperations);

  _.extend(AzureFile.prototype, {
    save: function (dirPath, options) {


      var filepath = path.join(dirPath, sanatize(this.name));
      var buffer = new Buffer(this.data);
      var mode = this.start == 0 ? 'w' : 'a';
      var fd = fs.openSync(filepath, mode);
      fs.writeSync(fd, buffer, 0, buffer.length, this.start);
      fs.closeSync(fd);
  },
    azureUpload:function(fileName,accountName,key,container,callback) {

      var buffer = new Buffer(this.data);
      retryOperations = new azure.ExponentialRetryPolicyFilter();
	  blobService = azure.createBlobService(accountName, key).withFilter(retryOperations);
	  var blockId = this.blockArray[this.blockArray.length-1];
	  var stream = new ReadableStreamBuffer(buffer);
	  var self = this;
	  Future = Npm.require('fibers/future');
      var myFuture = new Future;


      blobService.createBlockFromStream(blockId,container,fileName,stream,stream.size(),function(err,response)
        	{

        		if(err)
        		{
        			myFuture.return();
        		}
        		else if (response)
        		{     
        			
        			
        		 if (self.bytesUploaded+self.data.length >= self.size)
      				{
				      	 blobService.commitBlocks(container, fileName, {LatestBlocks: self.blockArray}, function(error, result){
				                if(error){
				                 myFuture.return();

				                } else {
				                    myFuture.return({url:"https://"+accountName+".blob.core.windows.net/"+container+"/"+fileName});
				                }
				            });
				


     			    }
     			    else
     			    {
     			    	 myFuture.return();
     			    }
     			    

        		}

        	});

      	return myFuture.wait();
        		


  	  }
      
    
  });
    
}