'use strict';

var IonicAppLib = require('ionic-app-lib');
var semver = require('semver');
var Ionitron = require('../lib/utils/ionitron');
var Q = require('q');
var helpUtils = require('../lib/utils/help');
var IonicStore = require('../lib/utils/store');
var IonicStats = require('../lib/utils/stats');
var Info = IonicAppLib.info;
var Utils = IonicAppLib.utils;
var Project = IonicAppLib.project;
var Logging = IonicAppLib.logging;
var log = Logging.logger;
var fs = require('fs');
var path = require('path');
var gulp = require('gulp');
var inquirer = require('inquirer');
var rewire = require('rewire');
var IonicCli = rewire('../lib/cli');

describe('Cli', function() {

  beforeEach(function() {
    spyOn(IonicCli, 'processExit');
    spyOn(helpUtils, 'printTaskListShortUsage');
    spyOn(helpUtils, 'printTaskListUsage');
    spyOn(IonicAppLib.events, 'on');
    spyOn(process, 'on');
    spyOn(Info, 'checkRuntime');
    spyOn(Utils, 'cdIonicRoot');
    spyOn(Project, 'load');

    spyOn(Utils, 'fail').andCallFake(function(err) {
      console.log(err);
      console.log(err.stack);
    });
  });

  it('should have cli defined', function() {
    expect(IonicCli).toBeDefined();
  });

  it('should have cli tasks defined', function() {
    expect(IonicCli.ALL_TASKS).toBeDefined();
  });

  describe('#run', function() {

    beforeEach(function() {
      spyOn(IonicCli, 'doRuntimeCheck');
    });

    describe('#Cli methods', function() {
      it('should run checkLatestVersion on run', function(done) {
        spyOn(IonicCli, 'checkLatestVersion').andReturn(Q(true));

        IonicCli.run(['node', 'bin/ionic', '--h'])
        .then(function() {
          expect(IonicCli.checkLatestVersion).toHaveBeenCalled();
          done();
        });
      });

      it('should run info doRuntimeCheck on run', function(done) {
        IonicCli.run(['node', 'bin/ionic', '--h'])
        .then(function() {
          expect(IonicCli.doRuntimeCheck).toHaveBeenCalled();
          done();
        });
      });

      it('should run ionitron when argument is passed', function(done) {
        spyOn(Ionitron, 'print');

        IonicCli.run(['node', 'bin/ionic', '--ionitron'])
        .then(function() {
          expect(Ionitron.print).toHaveBeenCalled();
          done();
        });
      });

      it('should change log level to debug when verbose arg is passed', function(done) {
        expect(IonicAppLib.logging.logger.level).toBe('info');

        IonicCli.run(['node', 'bin/ionic', '--verbose'])
        .then(function() {
          expect(IonicAppLib.logging.logger.level).toBe('debug');
          done();
        });
      });

      it('should get version when version flag passed', function(done) {
        spyOn(IonicCli, 'version');

        IonicCli.run(['node', 'bin/ionic', '--version'])
        .then(function() {
          expect(IonicCli.version).toHaveBeenCalled();
          done();
        });
      });

      it('should call help when help argument passed', function(done) {

        IonicCli.run(['node', 'bin/ionic', '--help'])
        .then(function() {
          expect(helpUtils.printTaskListUsage).toHaveBeenCalled();
          done();
        });
      });

      it('should call help when help shorthand argument passed', function(done) {

        IonicCli.run(['node', 'bin/ionic', '--h'])
        .then(function() {
          expect(helpUtils.printTaskListUsage).toHaveBeenCalled();
          done();
        });
      });

      it('should print available tasks if no valid command is passed', function(done) {

        IonicCli.run(['node', 'bin/ionic'])
        .then(function() {
          expect(helpUtils.printTaskListShortUsage).toHaveBeenCalled();
          done();
        });
      });

      it('should get the correct task by name', function() {
        var task = IonicCli.getTaskSettingsByName('start');
        expect(task).toBeDefined();
        expect(task.name).toBe('start');
        expect(task.args).toBeDefined();
      });

      it('should call attachErrorHandling', function(done) {
        spyOn(IonicCli, 'attachErrorHandling');

        IonicCli.run(['node', 'bin/ionic'])
        .then(function() {
          expect(IonicCli.attachErrorHandling).toHaveBeenCalled();
          done();
        });
      });

      it('should get boolean options from start task', function() {
        var task = IonicCli.getTaskSettingsByName('start');
        var booleanOptions = IonicCli.getListOfBooleanOptions(task.options);

        // We expect 6 total = 3 options, each with short hand notation.
        expect(booleanOptions.length).toBe(11);
      });

      it('should track stats for cli', function(done) {
        spyOn(IonicStats, 't');

        IonicCli.run(['node', 'bin/ionic', 'help'])
        .then(function() {
          expect(IonicStats.t).toHaveBeenCalled();
          done();
        });
      });

      it('should change cwd to project root for project tasks', function(done) {
        var FakeTask = {
          name: 'fake',
          title: 'fake',
          run: function() {
            return Q(true);
          },
          isProjectTask: true
        };
        spyOn(IonicCli, 'getTaskSettingsByName').andReturn(FakeTask);

        IonicCli.run(['node', 'bin/ionic', 'fake'])
        .then(function() {
          expect(Utils.cdIonicRoot).toHaveBeenCalled();
          done();
        });
      });

      it('should not change cwd to project root for non project tasks', function(done) {
        var FakeTask = {
          name: 'fake',
          title: 'fake',
          run: function() {
            return Q(true);
          },
          isProjectTask: false
        };
        spyOn(IonicCli, 'getTaskSettingsByName').andReturn(FakeTask);

        IonicCli.run(['node', 'bin/ionic', 'fake'])
        .then(function() {
          expect(Utils.cdIonicRoot).not.toHaveBeenCalled();
          done();
        });
      });

      it('should print a warning if using v2 and node_modules doesn\'t exist', function(done){
        spyOn(fs, 'existsSync').andReturn(false);
        Project.load = function(){
          return {
            get: function(){ return true }
          }
        };

        var FakeTask = {
          name: 'fake',
          title: 'fake',
          run: function() {
            return Q(true);
          },
          isProjectTask: true
        };
        spyOn(IonicCli, 'getTaskSettingsByName').andReturn(FakeTask);

        spyOn(log, 'warn');
        var runWithGulpSpy = jasmine.createSpy('runWithGulp');
        var runWithGulpRevert = IonicCli.__set__('runWithGulp', runWithGulpSpy);

        IonicCli.run(['node', 'bin/ionic', 'fake'])
        .then(function() {
          expect(log.warn).toHaveBeenCalledWith('WARN: No node_modules directory found, do you need to run npm install?'.yellow);
          expect(runWithGulpSpy).not.toHaveBeenCalled();
          runWithGulpRevert();
          done();
        });
      });

      it('should call Utils.fail if an exception occurrs within run', function() {
        var error = new Error('error happened');
        spyOn(IonicCli, 'checkLatestVersion').andCallFake(function() {
          throw error;
        });

        IonicCli.run(['node', 'bin/ionic', '--stats-opt-out']);
        expect(Utils.fail).toHaveBeenCalledWith(error);
      });

      it('should save to the config if stats-opt-out is passed', function(done) {
        spyOn(IonicStore.prototype, 'set');
        spyOn(IonicStore.prototype, 'save');

        IonicCli.run(['node', 'bin/ionic', '--stats-opt-out'])
        .then(function() {
          expect(IonicStore.prototype.set).toHaveBeenCalledWith('statsOptOut', true);
          expect(IonicStore.prototype.save).toHaveBeenCalled();
          done();
        });
      });
    });
  });

  describe('#commands options', function() {
    beforeEach(function() {
      spyOn(IonicCli, 'doRuntimeCheck');
    });

    it('should parse start options correctly', function(done) {
      var Start = require('../lib/ionic/start');
      spyOn(Start, 'run').andReturn(Q(true));

      var processArgs = ['node', '/usr/local/bin/ionic', 'start', 's1', '-w', '--appname', 'asdf'];

      IonicCli.run(processArgs).then(function() {
        var taskArgs = Start.run.mostRecentCall.args;

        var taskArgv = taskArgs[1];
        expect(taskArgv._.length).toBe(2);
        expect(taskArgv._[0]).toBe('start');
        expect(taskArgv._[1]).toBe('s1');
        expect(taskArgv.appname).toBe('asdf');
        expect(taskArgv.s).toBe(false);
        expect(taskArgv.sass).toBe(false);
        expect(taskArgv.l).toBe(false);
        expect(taskArgv.list).toBe(false);
        expect(taskArgv['no-cordova']).toBe(false);
        expect(taskArgv.w).toBe(true);
        expect(taskArgv.id).toBeUndefined();
        expect(taskArgv.i).toBeUndefined();
        done();
      });
    });

    it('should parse serve options correctly', function(done) {
      var Serve = require('../lib/ionic/serve');
      spyOn(Serve, 'run').andReturn(Q(true));

      var processArgs = ['node', '/usr/local/bin/ionic', 'serve', '--nogulp', '--all', '--browser', 'firefox'];

      IonicCli.run(processArgs).then(function() {
        var taskArgs = Serve.run.mostRecentCall.args;

        var taskArgv = taskArgs[1];

        // should only have serve in the command args
        expect(taskArgv._.length).toBe(1);
        expect(taskArgv.browser).toBe('firefox');
        expect(taskArgv.nogulp).toBe(true);
        expect(taskArgv.all).toBe(true);
        expect(taskArgv.lab).toBe(false);
        expect(taskArgv.nobrowser).toBe(false);
        done();
      });
    });

    it('should parse upload options correctly', function(done) {
      var Upload = require('../lib/ionic/upload');
      spyOn(Upload, 'run').andReturn(Q(true));

      var note = 'A note for notes';
      var processArgs = ['node', '/usr/local/bin/ionic', 'upload', '--email',
        'user@ionic.io', '--password', 'pass', '--note', note];

      IonicCli.run(processArgs).then(function() {
        var taskArgs = Upload.run.mostRecentCall.args;

        var taskArgv = taskArgs[1];

        // should only have serve in the command args
        expect(taskArgv._.length).toBe(1);
        expect(taskArgv.note).toBe(note);
        expect(taskArgv.email).toBe('user@ionic.io');
        expect(taskArgv.password).toBe('pass');
        done();
      });
    });

    it('should parse login options correctly', function(done) {
      var Login = require('../lib/ionic/login');
      spyOn(Login, 'run').andReturn(Q(true));

      var processArgs = ['node', '/usr/local/bin/ionic', 'login', '--email', 'user@ionic.io', '--password', 'pass'];

      IonicCli.run(processArgs).then(function() {
        var taskArgs = Login.run.mostRecentCall.args;

        var taskArgv = taskArgs[1];

        // should only have serve in the command args
        expect(taskArgv._.length).toBe(1);
        expect(taskArgv.email).toBe('user@ionic.io');
        expect(taskArgv.password).toBe('pass');
        done();
      }).catch(done);
    });

    it('should parse run options correctly', function(done) {
      var Run = require('../lib/ionic/run');
      spyOn(Run, 'run').andReturn(Q(true));

      var processArgs = ['node', '/usr/local/bin/ionic', 'run', 'ios', '--livereload',
        '--port', '5000', '-r', '35730', '--consolelogs', '--serverlogs', '--device'];

      IonicCli.run(processArgs).then(function() {
        var taskArgs = Run.run.mostRecentCall.args;

        var taskArgv = taskArgs[1];

        // should only have serve in the command args
        expect(taskArgv._.length).toBe(2);
        expect(taskArgv.r).toBe(35730);
        expect(taskArgv.port).toBe(5000);
        expect(taskArgv.consolelogs).toBe(true);
        expect(taskArgv.serverlogs).toBe(true);
        expect(taskArgv.livereload).toBe(true);
        expect(taskArgv.device).toBe(true);
        done();
      });
    });

    it('should parse emulate options correctly', function(done) {
      var Emulate = require('../lib/ionic/emulate');
      spyOn(Emulate, 'run').andReturn(Q(true));

      var processArgs = ['node', '/usr/local/bin/ionic', 'emulate', 'android',
        '--livereload', '--address', 'localhost', '--port', '5000', '-r', '35730', '--consolelogs', '--serverlogs'];

      IonicCli.run(processArgs).then(function() {
        var taskArgs = Emulate.run.mostRecentCall.args;

        var taskArgv = taskArgs[1];

        // should only have serve in the command args
        expect(taskArgv._.length).toBe(2);
        expect(taskArgv._[1]).toBe('android');
        expect(taskArgv.r).toBe(35730);
        expect(taskArgv.address).toBe('localhost');
        expect(taskArgv.port).toBe(5000);
        expect(taskArgv.consolelogs).toBe(true);
        expect(taskArgv.serverlogs).toBe(true);
        expect(taskArgv.livereload).toBe(true);
        done();
      });
    });

    it('should parse state options correctly', function(done) {
      var State = require('../lib/ionic/state');
      spyOn(State, 'run').andReturn(Q(true));

      var processArgs = ['node', '/usr/local/bin/ionic', 'state', 'save', '--plugins'];

      IonicCli.run(processArgs).then(function() {
        var taskArgs = State.run.mostRecentCall.args;

        var taskArgv = taskArgs[1];

        // should only have serve in the command args
        expect(taskArgv._.length).toBe(2);
        expect(taskArgv._[1]).toBe('save');
        expect(taskArgv.plugins).toBe(true);
        expect(taskArgv.platforms).toBe(false);
        done();
      });
    });

    it('should parse plugin options correctly', function(done) {
      var Plugin = require('../lib/ionic/plugin');
      spyOn(Plugin, 'run').andReturn(Q(true));

      var processArgs = ['node', '/usr/local/bin/ionic', 'plugin', 'add',
        'org.apache.cordova.splashscreen', '--nosave', '--searchpath', '../'];

      IonicCli.run(processArgs).then(function() {
        var taskArgs = Plugin.run.mostRecentCall.args;

        var taskArgv = taskArgs[1];

        // should only have serve in the command args
        expect(taskArgv._.length).toBe(3);
        expect(taskArgv._[0]).toBe('plugin');
        expect(taskArgv._[1]).toBe('add');
        expect(taskArgv._[2]).toBe('org.apache.cordova.splashscreen');
        expect(taskArgv.nosave).toBe(true);
        expect(taskArgv.searchpath).toBe('../');
        done();
      });
    });

    it('should parse build options correctly', function(done) {
      var Build = require('../lib/ionic/build');
      spyOn(Build, 'run').andReturn(Q(true));

      var processArgs = ['node', '/usr/local/bin/ionic', 'build', 'ios', '--nohooks'];

      IonicCli.run(processArgs).then(function() {
        var taskArgs = Build.run.mostRecentCall.args;

        var taskArgv = taskArgs[1];

        // should only have serve in the command args
        expect(taskArgv._.length).toBe(2);
        expect(taskArgv._[0]).toBe('build');
        expect(taskArgv._[1]).toBe('ios');
        expect(taskArgv.nohooks).toBe(true);
        done();
      });
    });

    describe('version checking for checkRuntime', function() {
      var IonicCli;

      beforeEach(function() {
        IonicCli = rewire('../lib/cli');
      });

      xit('should do runtime check when version is not checked', function() {
        var IonicConfigSpy = jasmine.createSpyObj('IonicConfig', ['get', 'set', 'save']);
        IonicConfigSpy.get.andReturn('1.6.4');
        var revertConfig = IonicCli.__set__('IonicConfig', IonicConfigSpy);
        IonicCli.doRuntimeCheck('1.6.4');

        expect(Info.checkRuntime).not.toHaveBeenCalled();
        expect(IonicConfigSpy.set).not.toHaveBeenCalled();
        expect(IonicConfigSpy.save).not.toHaveBeenCalled();
        revertConfig();
      });

      xit('should do runtime check when version is not checked', function() {
        var IonicConfigSpy = jasmine.createSpyObj('IonicConfig', ['get', 'set', 'save']);
        IonicConfigSpy.get.andReturn('1.6.4');
        var revertConfig = IonicCli.__set__('IonicConfig', IonicConfigSpy);
        IonicCli.doRuntimeCheck('1.6.5');

        expect(Info.checkRuntime).toHaveBeenCalled();
        expect(IonicConfigSpy.get).toHaveBeenCalled();
        expect(IonicConfigSpy.set).toHaveBeenCalledWith('lastVersionChecked', '1.6.5');
        expect(IonicConfigSpy.save).toHaveBeenCalled();
        revertConfig();
      });
    });
  });

  describe('runWithGulp function', function() {
    var fakeTask;

    beforeEach(function() {
      fakeTask = {
        name: 'fake',
        title: 'fake',
        run: function() {
          return Q(true);
        },
        isProjectTask: true
      };
      spyOn(fakeTask, 'run').andCallThrough();
      spyOn(process, 'exit');
    });

    it('should run the task and not gulp if there is no gulp file and the command is not v2', function(done) {
      var argv = {
        _: ['fake'],
        v2: false
      };
      var loadGulpFileSpy = jasmine.createSpy('loadGulpfile');
      loadGulpFileSpy.andReturn(false);
      var loadGulpFileRevert = IonicCli.__set__('loadGulpfile', loadGulpFileSpy);
      spyOn(fs, 'existsSync');
      spyOn(gulp, 'start');
      spyOn(inquirer, 'prompt');

      var runWithGulp = IonicCli.__get__('runWithGulp');

      runWithGulp(argv, fakeTask).then(function() {
        expect(loadGulpFileSpy).toHaveBeenCalled();
        expect(fakeTask.run).toHaveBeenCalled();

        expect(process.exit).not.toHaveBeenCalled();
        expect(fs.existsSync).not.toHaveBeenCalled();
        expect(gulp.start).not.toHaveBeenCalled();
        expect(inquirer.prompt).not.toHaveBeenCalled();
        loadGulpFileRevert();
        done();
      });
    });

    it('should try to load gulp file, exit if it fails', function() {
      var argv = {
        _: ['fake'],
        v2: false
      };
      var loadGulpFileSpy = jasmine.createSpy('loadGulpfile');
      loadGulpFileSpy.andReturn(true);
      var loadGulpFileRevert = IonicCli.__set__('loadGulpfile', loadGulpFileSpy);

      var logEventsSpy = jasmine.createSpy('logEvents');
      logEventsSpy.andReturn(true);
      var logEventsRevert = IonicCli.__set__('logEvents', logEventsSpy);

      spyOn(path, 'resolve').andReturn('./RKLERREulp');
      spyOn(log, 'error');
      spyOn(fs, 'existsSync');
      spyOn(gulp, 'start');
      spyOn(inquirer, 'prompt');

      var runWithGulp = IonicCli.__get__('runWithGulp');
      runWithGulp(argv, fakeTask);

      expect(loadGulpFileSpy).toHaveBeenCalled();
      expect(log.error).toHaveBeenCalled();
      expect(process.exit).toHaveBeenCalled();

      expect(logEventsSpy).not.toHaveBeenCalled();
      expect(fakeTask.run).not.toHaveBeenCalled();
      expect(fs.existsSync).not.toHaveBeenCalled();
      expect(gulp.start).not.toHaveBeenCalled();
      expect(inquirer.prompt).not.toHaveBeenCalled();
      loadGulpFileRevert();
      logEventsRevert();
    });

    /*
    it('should try to load gulp file, on success logEvents and call task', function(done) {
      var argv = {
        _: ['fake'],
        v2: false
      };

      var loadGulpFileSpy = jasmine.createSpy('loadGulpfile');
      loadGulpFileSpy.andReturn(true);
      var loadGulpFileRevert = IonicCli.__set__('loadGulpfile', loadGulpFileSpy);

      var logEventsSpy = jasmine.createSpy('logEvents');
      logEventsSpy.andReturn(true);
      var logEventsRevert = IonicCli.__set__('logEvents', logEventsSpy);

      spyOn(log, 'error');
      spyOn(fs, 'existsSync');
      spyOn(gulp, 'start');
      spyOn(inquirer, 'prompt');

      var runWithGulp = IonicCli.__get__('runWithGulp');
      runWithGulp(argv, fakeTask).then(function() {

        expect(loadGulpFileSpy).toHaveBeenCalled();
        expect(logEventsSpy).toHaveBeenCalled();
        expect(gulp.start).toHaveBeenCalledWith('fake:before');
        expect(gulp.start).toHaveBeenCalledWith('fake:after');
        expect(fakeTask.run).toHaveBeenCalledWith(IonicCli, argv);

        expect(log.error).not.toHaveBeenCalled();
        expect(process.exit).not.toHaveBeenCalled();
        expect(fs.existsSync).not.toHaveBeenCalled();
        expect(inquirer.prompt).not.toHaveBeenCalled();
        loadGulpFileRevert();
        logEventsRevert();
        done();
      }).catch(done);
    });
    */
  });

  describe('processExit method', function() {
  });

  describe('gatherInfo method', function() {
    it('should return an object and gather info from Info function from app-lib', function() {
      spyOn(Info, 'gatherInfo').andReturn({});
      spyOn(Info, 'getIonicVersion');
      spyOn(Info, 'getIonicCliVersion');

      var info = IonicCli.gatherInfo();

      expect(info).toEqual(jasmine.any(Object));
    });
  });

  describe('printVersionWarning method', function() {
    it('should write out a warning if the version is not equal to version specified by the cli', function() {
      spyOn(log, 'warn');

      IonicCli.printVersionWarning('2.0.1', '2.0.2');
      expect(log.warn).toHaveBeenCalled();
    });
    it('should not write out a warning if the version is equal to version specified by the cli', function() {
      spyOn(log, 'warn');

      IonicCli.printVersionWarning('2.0.1', '2.0.1');
      expect(log.warn).not.toHaveBeenCalled();
    });

    it('should not write out a warning if the version is in beta', function() {
      spyOn(log, 'warn');

      IonicCli.printVersionWarning('2.0.1-beta', '2.0.1');
      expect(log.warn).not.toHaveBeenCalled();
    });

    it('should not write out a warning if the version is in alpha', function() {
      spyOn(log, 'warn');

      IonicCli.printVersionWarning('2.0.1-alpha', '2.0.1');
      expect(log.warn).not.toHaveBeenCalled();
    });
  });

  describe('formatGulpError function', function() {
    var formatGulpError = IonicCli.__get__('formatGulpError');

    it('should return e.message if e.err is null', function() {
      var error = new Error('gulp broke');
      error.err = null;

      var results = formatGulpError(error);
      expect(results).toEqual(error.message);
    });

    it('should return a string if the error is in a plugin', function() {
      var error = {
        err: {
          showStack: 'boolean'
        }
      };

      var results = formatGulpError(error);
      expect(results).toEqual(jasmine.any(String));
    });

    it('should return a stack if it exists', function() {
      var testError = new Error('gulp broke');
      var error = {
        err: testError
      };

      var results = formatGulpError(error);
      expect(results).toEqual(testError.stack);
    });

    it('should return a new error if it does not understand the error', function() {
      var error = {
        err: 'Something broke somewhere'
      };
      var results = formatGulpError(error);
      expect(results).toContain(error.err);
    });
  });

  describe('checkLatestVersion method', function() {
    it('should not check npm if current version is a beta', function() {
      spyOn(IonicStore.prototype, 'get');
      spyOn(IonicStore.prototype, 'set');
      spyOn(IonicStore.prototype, 'save');
      var npmVersion = IonicCli.npmVersion;

      var result = IonicCli.checkLatestVersion('2.0.1-beta');
      expect(result).toEqual(null);
      expect(npmVersion).toEqual(IonicCli.npmVersion);
      expect(IonicStore.prototype.get).not.toHaveBeenCalled();
      expect(IonicStore.prototype.set).not.toHaveBeenCalled();
      expect(IonicStore.prototype.save).not.toHaveBeenCalled();
    });

    it('should not check npm if timestamp is recent', function() {
      spyOn(IonicStore.prototype, 'get').andReturn(new Date().getTime());
      spyOn(IonicStore.prototype, 'set');
      spyOn(IonicStore.prototype, 'save');
      var npmVersion = IonicCli.npmVersion;

      var result = IonicCli.checkLatestVersion('2.0.1');
      expect(result).toEqual(null);
      expect(npmVersion).toEqual(IonicCli.npmVersion);
      expect(IonicStore.prototype.set).not.toHaveBeenCalled();
      expect(IonicStore.prototype.save).not.toHaveBeenCalled();
    });

    it('should check npm if timestamp is recent', function(done) {
      spyOn(IonicStore.prototype, 'get').andReturn(new Date(2016, 1, 1).getTime());
      spyOn(IonicStore.prototype, 'set');
      spyOn(IonicStore.prototype, 'save');
      var revertRequest = IonicCli.__set__('request', function(options, callback) {
        callback(null, null, '{ "version": "1.0.1" }');
      });

      IonicCli.checkLatestVersion('2.0.1').then(function() {
        expect(IonicStore.prototype.set).toHaveBeenCalledWith('versionCheck', jasmine.any(Number));
        expect(IonicStore.prototype.save).toHaveBeenCalled();
        revertRequest();
        done();
      });
    });
  });

  describe('printNewsUpdates method', function() {
    it('should log request info if a valid response is returned', function(done) {
      spyOn(log, 'info');
      var revertRequest = IonicCli.__set__('request', function(options, callback) {
        callback(null, { statusCode: '200' }, '{ "version": "1.0.1" }');
      });
      IonicCli.printNewsUpdates().then(function() {
        expect(log.info).toHaveBeenCalled();
        revertRequest();
        done();
      });
    });
  });

  describe('doRuntimeCheck method', function() {
    it('should update IonicConfig if semver is not met', function() {
      var version = '0.2.0';
      var error = new Error('semver failure');
      spyOn(IonicStore.prototype, 'get').andReturn('0.1.0');
      spyOn(IonicStore.prototype, 'set');
      spyOn(IonicStore.prototype, 'save');
      spyOn(semver, 'satisfies').andCallFake(function() {
        throw error;
      });

      IonicCli.doRuntimeCheck(version);
      expect(IonicStore.prototype.set).toHaveBeenCalledWith('lastVersionChecked', version);
      expect(IonicStore.prototype.save).toHaveBeenCalled();
    });

    it('should update IonicConfig if lastVersionChecked from IonicConfig is not available', function() {
      var version = '0.2.0';
      spyOn(IonicStore.prototype, 'get').andReturn(null);
      spyOn(IonicStore.prototype, 'set');
      spyOn(IonicStore.prototype, 'save');

      IonicCli.doRuntimeCheck(version);
      expect(IonicStore.prototype.set).toHaveBeenCalledWith('lastVersionChecked', version);
      expect(IonicStore.prototype.save).toHaveBeenCalled();
    });

    it('should not update IonicConfig if lastVersionChecked is available and semver is met', function() {
      var version = '0.2.0';
      spyOn(IonicStore.prototype, 'get').andReturn('0.2.0');
      spyOn(IonicStore.prototype, 'set');
      spyOn(IonicStore.prototype, 'save');
      spyOn(semver, 'satisfies').andReturn(true);

      IonicCli.doRuntimeCheck(version);
      expect(IonicStore.prototype.set).not.toHaveBeenCalled();
      expect(IonicStore.prototype.save).not.toHaveBeenCalled();
    });
  });

  describe('getContentSrc method', function() {
    it('should call getContentSrc util for process cwd.', function() {
      spyOn(process, 'cwd').andReturn('/some/dir');
      spyOn(Utils, 'getContentSrc').andCallFake(function(param) {
        return param;
      });
      var result = IonicCli.getContentSrc();
      expect(process.cwd).toHaveBeenCalled();
      expect(Utils.getContentSrc).toHaveBeenCalledWith('/some/dir');
      expect(result).toEqual('/some/dir');
    });
  });

  describe('fail method', function() {
    it('should call fail util.', function() {
      IonicCli.fail('some error', 'task help text');
      expect(Utils.fail).toHaveBeenCalledWith('some error', 'task help text');
    });
  });

  describe('handleUncaughtExceptions method', function() {
    it('log an error and then exit if param is a string', function() {
      spyOn(log, 'error');
      spyOn(process, 'exit');
      spyOn(Utils, 'errorHandler');

      IonicCli.handleUncaughtExceptions('error message');
      expect(Utils.errorHandler).toHaveBeenCalledWith('error message');
      expect(process.exit).toHaveBeenCalledWith(1);
    });

    it('log an error and then exit if param is an object', function() {
      spyOn(log, 'error');
      spyOn(process, 'exit');
      spyOn(Utils, 'errorHandler');

      IonicCli.handleUncaughtExceptions({ message: 'error message' });
      expect(Utils.errorHandler).toHaveBeenCalledWith('error message');
      expect(process.exit).toHaveBeenCalledWith(1);
    });
  });
});
