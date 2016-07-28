import * as couchbase from 'couchbase';
import asl from 'async';
import test from 'ava';
import _ from 'lodash';
import Driver from '../';

const mockData = [{
  key: 'driver_test_mock_1',
  value: {
    foo: 'bar'
  }
}, {
  key: 'driver_test_mock_2',
  value: {
    firstName: 'Bob',
    lastName: 'Smith'
  }
}, {
  key: 'driver_test_mock_3',
  value: {
    firstName: 'Bill',
    lastName: 'Jones'
  }
}];

function getCluser() {
  return process.env.TEST_USE_COUCHBASE_MOCK ?
    new couchbase.Mock.Cluster('couchbase://127.0.0.1') :
    new couchbase.Cluster('couchbase://127.0.0.1');
}

const cluster = getCluser();
let bucket = null;
let driver = null;

test.cb.before(t => {
  // check exports
  t.truthy(Driver);
  t.truthy(Driver.OPERATIONS);
  t.truthy(Driver.OPERATIONS.UPSERT);
  t.truthy(Driver.OPERATIONS.REMOVE);
  t.truthy(Driver.OPERATIONS.NOOP);

  bucket = cluster.openBucket('couchbase_driver_test', err => {
    t.falsy(err);

    bucket.manager().flush(err => {
      t.falsy(err);

      driver = Driver.create(bucket);

      // check creation
      t.truthy(driver);
      t.truthy(driver.OPERATIONS);
      t.truthy(driver.OPERATIONS.UPSERT);
      t.truthy(driver.OPERATIONS.REMOVE);
      t.truthy(driver.OPERATIONS.NOOP);

      asl.each(mockData, (data, eacb) => {
        bucket.upsert(data.key, data.value, eacb);
      }, t.end);
    });
  });
});

test.cb('should get a document using the custom get', t => {
  driver.get(mockData[0].key, (err, res) => {
    t.falsy(err);

    t.truthy(res);
    t.true(typeof res === 'object');
    t.truthy(res.cas);
    t.true(typeof res.cas === 'object');
    t.truthy(res.value);
    t.true(typeof res.value === 'object');
    t.deepEqual(res.value, mockData[0].value);
    t.end();
  });
});

test.cb('should get an array of documents using the custom get', t => {
  const keys = _.map(mockData, 'key');

  driver.get(keys, (errors, results, misses) => {
    t.falsy(errors);

    t.truthy(misses);
    t.true(Array.isArray(misses));
    t.is(misses.length, 0);

    t.truthy(results);
    t.true(Array.isArray(results));

    const actual = _.map(results, 'value');
    const expected = _.map(mockData, 'value');

    t.deepEqual(actual, expected);

    t.end();
  });
});

test.cb('should get an array of documents using the custom get and return misses', t => {
  const keys = ['driver_test_mock_1', 'driver_test_mock_2', 'driver_test_mock_4', 'driver_test_mock_3'];

  driver.get(keys, (errors, results, misses) => {
    t.falsy(errors);

    t.truthy(misses);
    t.true(Array.isArray(misses));
    t.is(misses.length, 1);
    t.deepEqual(misses, ['driver_test_mock_4']);

    t.truthy(results);
    t.true(Array.isArray(results));
    const actual = _.map(results, 'value');
    const expected = _.map(mockData, 'value');
    t.deepEqual(actual, expected);

    t.end();
  });
});

test.cb('should call upsert as is on normal bucket', t => {
  driver.upsert('driver_test_mock_4', {
    somedata: 1234
  }, err => {
    t.falsy(err);

    t.end();
  });
});

test.cb('should call getMulti as is on normal bucket', t => {
  driver.getMulti(['driver_test_mock_3', 'driver_test_mock_4'], (err, res) => {
    t.falsy(err);

    t.truthy(res);
    t.true(typeof res === 'object');

    t.true(typeof res.driver_test_mock_3 === 'object');
    t.true(typeof res.driver_test_mock_3.value === 'object');
    t.deepEqual(res.driver_test_mock_3.value, mockData[2].value);

    t.true(typeof res.driver_test_mock_4 === 'object');
    t.true(typeof res.driver_test_mock_4.value === 'object');
    t.deepEqual(res.driver_test_mock_4.value, { somedata: 1234 });

    t.end();
  });
});

test.cb('should get all of documents using the custom get', t => {
  const keys = _.map(mockData, 'key');
  keys.push('driver_test_mock_4');

  driver.get(keys, (errors, results, misses) => {
    t.falsy(errors);

    t.truthy(misses);
    t.true(Array.isArray(misses));
    t.is(misses.length, 0);

    t.truthy(results);
    t.true(Array.isArray(results));

    const actual = _.map(results, 'value');
    const expected = _.map(mockData, 'value');
    expected.push({ somedata: 1234 });
    t.deepEqual(actual, expected);

    t.end();
  });
});

test('promised: should get a document using the custom get', async t => {
  t.plan(5);

  const res = await driver.get(mockData[0].key);
  t.truthy(res);
  t.true(typeof res === 'object');
  t.true(typeof res.cas === 'object');
  t.true(typeof res.value === 'object');
  t.deepEqual(res.value, mockData[0].value);
});

test.cb('promised: should get a document using the custom get as then() style call', t => {
  driver.get(mockData[0].key).then(res => {
    t.truthy(res);
    t.true(typeof res === 'object');
    t.true(typeof res.cas === 'object');
    t.true(typeof res.value === 'object');
    t.deepEqual(res.value, mockData[0].value);
    t.end();
  });
});

test('promised: should get an array of documents using the custom get', async t => {
  t.plan(3);

  const keys = _.map(mockData, 'key');
  const results = await driver.get(keys);
  t.truthy(results);
  t.true(Array.isArray(results));

  const actual = _.map(results, 'value');
  const expected = _.map(mockData, 'value');

  t.deepEqual(actual, expected);
});

test('promised: should get an array of documents using the custom get and not get misses', async t => {
  t.plan(3);
  const keys = ['driver_test_mock_1', 'driver_test_mock_2', 'driver_test_mock_123', 'driver_test_mock_3'];
  const results = await driver.get(keys);
  t.truthy(results);
  t.true(Array.isArray(results));
  const actual = _.map(results, 'value');
  const expected = _.map(mockData, 'value');
  t.deepEqual(actual, expected);
});

test.cb('promised: should get an array of documents using the custom get and not get misses using then() style', t => {
  const keys = ['driver_test_mock_1', 'driver_test_mock_2', 'driver_test_mock_123', 'driver_test_mock_3'];
  driver.get(keys).then(results => {
    t.truthy(results);
    t.true(Array.isArray(results));
    const actual = _.map(results, 'value');
    const expected = _.map(mockData, 'value');
    t.deepEqual(actual, expected);
    t.end();
  });
});