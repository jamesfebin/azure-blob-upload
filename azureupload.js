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
    _id:value._id
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
      _id:this._id
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
      _id:this._id
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
      var chunkSize = options.size || 1024 * 1024 *2;

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
      	var blob = file.slice(this.start , self.end);
      	reader.readAsArrayBuffer(blob);
      }
      reader.readAsArrayBuffer(file);

      return this;
    },
    rewind: function ()
    {
    	this.data = null;
    	this.start = 0;
    	this.end = 0;
    	this.bytesRead = 0;
    	this.bytesUploaded = 0;
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


    	options = options || {};

    	self.rewind();
    	self.size = file.size;
    	var readNext = function(){

    		if(self.bytesUploaded < self.size){
    			self.read(file, options, function(err,res)
    			{
    				if (err && callback)
    					callback(err);
    				else if (err)
    					throw err;
    				else
    				{
    				Meteor.apply(
    					method,
    					[self].concat(options.params || []),
    					{
    						wait:true
    					},
    					function(err)
    					{
    						if(err && callback)
    							callback(err);
    						else if (err)
    							throw err;
    						else {
    							self.bytesUploaded += self.data.length;
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
  var fs = Npm.require('fs');
  var path = Npm.require('path');
  var azure = Npm.require('azure-storage');
  var stream = Npm.require('stream');
  var util = Npm.require('util');
// use Node.js Writable, otherwise load polyfill


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
  	return fileName.replace(/\//g,'').replace(/\.\.+/g,'.')
  }

  _.extend(AzureFile.prototype, {
    save: function (dirPath, options) {
      var filepath = path.join(dirPath, sanatize(this.name));
      var buffer = new Buffer(this.data);
      var mode = this.start == 0 ? 'w' : 'a';
      var fd = fs.openSync(filepath, mode);
      fs.writeSync(fd, buffer, 0, buffer.length, this.start);
      fs.closeSync(fd);
  },
    azureUpload:function(fileName,accountName,key,container) {


    	retryOperations = new azure.ExponentialRetryPolicyFilter();

    	blobService = azure.createBlobService(accountName, key).withFilter(retryOperations);
        var buffer = new Buffer(this.data);
   

    	
        blobService.createBlockBlobFromStream(container,fileName,new ReadableStreamBuffer(buffer),buffer.length,function(err,response)
        	{

        		if(err && callback)
        			callback(err);
        		else if (err)
        			throw err
        		
        		else
        			console.log('Data uploaded to azure succesfully ');

        	});

  	  }
      
    
  });
    
}