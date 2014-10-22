defaultZero = (value) ->
	(if _.isUndefined(value) then 0 else value)
AzureFile = (options) ->
	options = options or {}
	@name = options.name
	@type = options.type
	@size = options.size
	@data = options.data
	@start = defaultZero(options.start)
	@end = defaultZero(options.end)
	@bytesRead  = defaultZero(options.bytesRead)
	@bytesUploaded = defaultZero(options.bytesUploaded)
	@_id = options._id || Meteor.uuid();

	return


AzureFile.fromJSONValue = (value) ->

	new AzureFile(
		name: value.name
		type: value.type
		size: value.size
		data: EJSON.fromJSONValue(value.data)
		start: value.start
		end: value.end
		bytesRead: value.bytesRead
		bytesUploaded: value.bytesUploaded
		_id: value._id
	)

AzureFile:: = 
	constructor : AzureFile

	typeName : ->
		 "AzureFile"
	clone : ->
		 new AzureFile
			name : @name
			type : @type
			size : @size
			data : @data
			start: @start
			end: @end
			bytesRead: @bytesRead
			bytesUploaded: @bytesUploaded
			_id: @_id
		
	toJSONValue : ->
			name : @name
			type : @type
			size : @size
			data : EJSON.toJSONValue(@data)
			start: @start
			end: @end
			bytesRead: @bytesRead
			bytesUploaded: @bytesUploaded
			_id: @_id
	equals : (other) ->
		true if other._id is @_id

EJSON.addType "AzureFile", AzureFile.fromJSONValue

if Meteor.isClient
	_.extend AzureFile::,
		read: (file,options,callback) ->



			if arguments.length is 2
				callback = options

			options = options || {}



			reader = new FileReader
			self = this
			chunkSize = options.size || 1024 * 1024 *2

			callback = callback or ->


			self.size = file.size
			self.start = self.end;
			self.end += chunkSize

			if self.end > self.size
				self.end = self.size


			reader.onload = ->
				self.bytesRead += self.end - self.start
				self.data = new Uint8Array(reader.result)
				callback(null, self)
 
			reader.onerror = ->
				callback(reader.error) && callback

			if (this.end - this.start) > 0 
				blob = file.slice(self.start,self.end)
				reader.readAsArrayBuffer(blob)


			reader.readAsArrayBuffer(file)
			return this
		rewind : ->
			@data = null
			@start = 0
			@end = 0
			@bytesRead = 0
			@bytesUploaded = 0
		upload : (file,method,options,callback) ->

			self = this

			if(!Blob.prototype.isPrototypeOf(file))
				throw new Meteor.error("First parameter must inherit from a blob ")
			if(!_.isString(method))
				throw new Meteor.error ("Second parameter must be a Meteor.method")

			if(arguments.length<4 && _.isFunction(options))
				callback = options 
				options = {}

			options = options || {}

			self.rewind()
			self.size = file.size
		

			readNext = ->
				if self.bytesUploaded < self.size
					self.read file, options,(err,res) ->
						if err 
							self.rewind()
							callback && callback(err)
						else

							Meteor.apply method,file,(err) ->
								if err & callback
									callback err
								else if err
									throw err
								else
									self.bytesUploaded += self.data.length
									readNext()
						
				else
					callback && callback(null,self )

			readNext()
			return this
		
	_.extend AzureFile,
		read: (file, options, callback) ->
			new AzureFile(file).read(file, options, callback)
		upload : (file,method,options,callback) ->
			new AzureFile(file).upload(file,method,options,callback)


	

if Meteor.isServer
	fs = Meteor.npmRequire("fs")
	path = Meteor.npmRequire("path")
	sanatize = (filename) ->
		return filename.replace(/\//g,'').replace(/\.\.+/g,'.')
			
	_.extend AzureFile::,
	save : (dirPath,options) ->
		filepath = path.join(dirPath,sanatize(@name))
		buffer = new Buffer(@data)
		mode = (if @start is 0 then 'w' else 'a')
		fd = fs.openSync filepath,mode
		fs.writeSync fd,buffer,0,buffer.length,@start
		fs.closeSync fd
	'''
		save: (dirPath, options) ->
			console.log(dirPath + @name)
			filepath = path.join(dirPath,@name)
			buffer = new Buffer(@data)
			fs.writeFileSync filepath,buffer,options
			return
	_.extend AzureFile,
		save: (file,dirPath,options) ->
			filepath = path.join(dirPath,file.name)
			buffer = new Buffer(file.data)
			fs.writeFileSync filepath,buffer,options
			return
	'''






