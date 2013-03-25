var zip = require('zip')
  , request = require('request')

  , requestPool = { maxSockets: 20 }

  , unzip = function (zipEntry, buffer) {
      var reader = zip.Reader(buffer)
        , data = null
      // iterate through zipfile entries looking for the right name
      reader.forEach(function(entry) {
        if (zipEntry === entry._header.file_name) {
          data = entry._stream.toString();
        }
      })
      return data
    }

  , fetch = function (sourceUrl, zipEntry, callback) {
      var options = {
              url: sourceUrl
            , encoding: zipEntry ? null : 'utf8'
            , timeout: 1 * 60 * 1000
            , pool: requestPool
            , maxRedirects: 2
          }
        , handle = function (err, response, body) {
            if (err)
              return callback(err)

            if (zipEntry) {
              try {
                body = unzip(zipEntry, body)
              } catch (e) {
                callback('unzip error' + e)
              }
              if (!body)
                return callback('could not find entry "' + zipEntry + '" inside zip file')
            }

            callback(null, body)
          }

      request(options, handle)
    }

module.exports = fetch