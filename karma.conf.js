module.exports = function (config) {
  config.set({
    frameworks: ['browserify', 'jasmine'],
    files: [
      'src/**/*.js',
      'test/**/*_spec.js',
    ],
    preprocessors: {
      'test/**/*.js': ['browserify'],
      'src/**/*.js': ['browserify'],
    },
    browsers: ['Chrome_without_security'],
    browserify: {
      debug: true,
      bundleDelay: 2000
    },
    customLaunchers: {
      Chrome_without_security: {
        base: 'Chrome',
        flags: ['--disable-web-security', '--disable-site-isolation-trials'],
      }
    }
  })
}