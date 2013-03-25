var events = require('events')
  , async = require('async')
  , fetch = require('./fetcher')
  , sizer = require('./sizer')

var Processor = {
    // called for each library, async
    // we must call either error() or success() at some point
    processLibrary: function (lib, callback) {
      if (!lib.name)
        return callback('library has no name, ignoring')

      if (!lib.source)
        return callback('has no source, ignoring')

      var sources = Array.isArray(lib.source) ? lib.source : [ lib.source ]

      var data = ''
        , warned = false

      // this is slightly awkward so we can support arrays of sources, otherwise
      // it'd be simple, but who wants simple?
      // concat all the file contents together and we do it in series because
      // order may matter for minification
      async.forEachSeries(
          sources
        , function (source, callback) {
            var match
              , zipEntry

            if (/\d\.\d/.test(source) && !warned) {
              this.emit('warning', lib, 'appears to have a versioned source, please check it\'s current')
              warned = true
            }

            // whoa, source is in the source
            if (!/^(http|ftp)/.test(source) && /function/.test(source)) {
              lib.novalidate = true
              data += source
              return callback()
            } else {
              // source is a zip with a bang-path to the file within the zip?
              if (match = source.match(/^(.*\.zip)!\/(.*$)/)) {
                source = match[1]
                zipEntry = match[2]
              } else
                zipEntry = null

              fetch(source, zipEntry, function (err, d) {
                if (err)
                  return callback(err)
                // append data because it can be split across multiple files
                data += d
                callback()
              })
            }
          }.bind(this)
        , function (err) {
            this.downloaded(lib, err, data, callback)
          }.bind(this)
      )
    }

  , downloaded: function (lib, err, data, callback) {
      if (err || (err = this.validator.raw(data)))
        return callback(err)
      // phew, we got this far, now calculate the 3 sizes and get to success()
      sizer(data, this.processed.bind(this, lib, callback))
    }

  , processed: function (lib, callback, err, sizes) {
      if (err)
        return callback(err)

      var insane = !lib.novalidate && this.validator.sizes(lib, sizes)
      if (insane)
        return callback(insane + ', ignoring')

      // holy moly! we got here?
      callback(null, sizes)
    }
}

Processor.__proto__ = events.EventEmitter.prototype

module.exports.create = function (config) {
  var processor = Object.create(Processor)
  events.EventEmitter.call(processor)
  processor.validator = require('./validator').create(config)
  return processor
}