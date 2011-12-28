var app = require('express').createServer()
  , io = require('socket.io').listen(app)
  , mongo = require('mongoose')
  , amqp = require('amqp')
  , cf = require("cloudfoundry");

//cloudfoundry conf
function rabbitConfig() {
	if (process.env.VCAP_SERVICES) {
		conf = JSON.parse(process.env.VCAP_SERVICES);
		return {url : conf['swagger-rabbitmq'][0].credentials.url};
	}
	else {
		return {host: "localhost"};
	}
}

function mongoConfig(){
	if (process.env.VCAP_SERVICES) {
		return cf.getServiceConfig("swagger-mongodb");
	}
	else {
		return 'mongodb://localhost/keynote-database';
	}
}

//mongoose
mongo.connect(mongoConfig());
var Schema = mongo.Schema
  , ObjectId = Schema.ObjectId;
var ChatSchema = new Schema({
	id		: ObjectId
  , from	: String
  , message	: String
  , created	: Date
})
var Chats = mongo.model('chats', ChatSchema);

// express
app.listen(80, function(){
	// socket.io
	io.sockets.on('connection', function(socket){
		// send first message
		socket.emit('news', {hello: 'world'});		
		// amqp
		var connection = amqp.createConnection(rabbitConfig());
		connection.on('ready', function(){
			var queue = connection.queue('new-chat');
			// subscribe 'myq' queue
			queue.subscribe(function(message){
				// receive chat's id from RabbitMQ.
				var chatId = message.data.toString();
				// find Chat data from MongoDB.
				Chats.findById(chatId, function(err, chat){
					if(!err) {
						io.sockets.emit('chat', {message: chat}); 
					}
				});
			});
		});	
	});
});