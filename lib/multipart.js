var readFile = require('fs').readFile,
    basename = require('path').basename;

exports.build = function(data, boundary, callback) {

  if (typeof data != 'object')
    return callback(new Error('Multipart builder expects data as key/val object.'));

  var body   = '',
      object = flatten(data),
      count  = Object.keys(object).length;

  if (count === 0)
    return callback(new Error('Empty multipart body. Invalid data.'))

  var done = function(err, section) {
    if (err) return callback(err);
    if (section) body += section;
    --count || callback(null, body + '--' + boundary + '--');
  };

  for (var key in object) {

    var value = object[key];
    if (value === null || typeof value == 'undefined') {
      done();
    } else {
      var part = (value.buffer || value.file || value.content_type) ? value : {value: value};
      generate_part(key, part, boundary, done);
    }
  }

}

var generate_part = function(name, part, boundary, callback) {

  var return_part = '--' + boundary + '\r\n';
  return_part += 'Content-Disposition: form-data; name="' + name + '"';

  var append = function(data, filename) {

    if (data) {
      var binary = part.content_type.indexOf('text') == -1;
      // 这里filename被encodeURIComponent, 中文会有问题
      // return_part += '; filename="' + encodeURIComponent(filename) + '"\r\n'; 
      // return_part += '; filename="' + filename + '"\r\n'; 
      // 改成这样
      return_part += '; filename="' + new Buffer(filename, 'utf8').toString("binary") + '"\r\n'; 
      // return_part += new Buffer(part.value+'', 'utf8').toString("binary");

      if (binary) return_part += 'Content-Transfer-Encoding: binary\r\n';
      return_part += 'Content-Type: ' + part.content_type + '\r\n\r\n';
      return_part += binary ? data.toString('binary') : data.toString('utf8');
    }

    callback(null, return_part + '\r\n');
  };

  if ((part.file || part.buffer) && part.content_type) {

    var filename = part.filename ? part.filename : part.file ? basename(part.file) : name;
    if (part.buffer) return append(part.buffer, filename);

    readFile(part.file, function(err, data) {
      if (err) return callback(err);
      append(data, filename);
    });

  } else {

    if (typeof part.value == 'object')
      return callback(new Error('Object received for ' + name + ', expected string.'))

    if (part.content_type) {
      return_part += '\r\n';
      return_part += 'Content-Type: ' + part.content_type;
    }

    return_part += '\r\n\r\n';

    // https://github.com/tomas/needle/issues/97
    // return_part += part.value;
    return_part += new Buffer(part.value+'', 'utf8').toString("binary");
    append();

  }

}

// flattens nested objects for multipart body
var flatten = function(object, into, prefix) {
  into = into || {};

  for(var key in object) {
    var prefix_key = prefix ? prefix + '[' + key + ']' : key;
    var prop = object[key];

    if (prop && typeof prop === 'object' && !(prop.buffer || prop.file || prop.content_type))
      flatten(prop, into, prefix_key)
    else
      into[prefix_key] = prop;
  }

  return into;
}
