const rp = require('request-promise');
const lib = require('../../../lib/index');
const models = require('../../../mongo/models.mongo');
const error = require('../../../lib/errors.list');
const mongoose = require('mongoose');
const _const = require('../../../lib/const.list');
const warehouses = require('../../../warehouses')
const deliveryDurationInfo = require('../../../deliveryDurationInfo')
const utils = require('./utils');

describe('POST Order - ORP', () => {
  let orders, products;
  let customer = {
    cid: null,
    jar: null
  };


  beforeEach(async done => {
    try {

      await lib.dbHelpers.dropAll()

      await models()['DeliveryDurationInfoTest'].insertMany(deliveryDurationInfo)
      await models()['WarehouseTest'].insertMany(warehouses)

      let res = await lib.dbHelpers.addAndLoginCustomer('customer1', '123456', {
        first_name: 'test 1',
        surname: 'test 1',
        address: utils.loggedInCustomerAddress
      });

      customer.cid = res.cid;
      customer.jar = res.rpJar;

      products = await utils.makeProducts();
      orders = await utils.makeOrders(customer);

      for (let i = 0; i < orders.length; i++) {

        let res = await models()['OrderTest'].findOneAndUpdate({
          _id: orders[i]._id
        }, {
            $set: {
              tickets: [],
              is_cart: true,
              transaction_id: null,
            },
            $unset: {
              address: 1,
              delivery_info: 1,
              is_collect: 1,
              total_amount: 1,
            }

          }, {new: true});

        orders[i] = JSON.parse(JSON.stringify(res));
      }

      done();
    } catch (err) {
      console.log(err);
    };
  }, 15000);

  it('login user not cc checkout ', async function (done) {
    try {
      this.done = done;
      let res = await models()['OrderTest'].findOneAndUpdate({
        _id: orders[0]._id
      }, {
          $set: {
            order_lines: [
              {
                product_price: 0,
                paid_price: 0,
                cancel: false,
                product_id: products[0]._id,
                product_instance_id: products[0].instances[0]._id,
                tickets: []
              },
              {
                product_price: 0,
                paid_price: 0,
                cancel: false,
                product_id: products[0]._id,
                product_instance_id: products[0].instances[0]._id,
                tickets: []
              },
              {
                product_price: 0,
                paid_price: 0,
                cancel: false,
                product_id: products[0]._id,
                product_instance_id: products[0].instances[1]._id,
                tickets: []
              }
            ],
          },
        }, {new: true});

      orders[0] = JSON.parse(JSON.stringify(res));
      let PreInventory1 = products[0].instances[0].inventory.find(x =>
        x.warehouse_id.toString() === warehouses[1]._id.toString());

      let PreInventory2 = products[0].instances[1].inventory.find(x =>
        x.warehouse_id.toString() === warehouses[1]._id.toString());

      res = await rp({
        method: 'POST',
        uri: lib.helpers.apiTestURL(`checkout/true`),
        body: {
          order_id: orders[0]._id,
          address: utils.loggedInCustomerAddress,
          duration_id: deliveryDurationInfo[0]._id,
          is_collect: false,
          time_slot: {
            lower_bound: 10,
            upper_bound: 18
          },

        },
        method: 'POST',
        uri: lib.helpers.apiTestURL(`checkout/true`),
        jar: customer.jar,
        json: true,
        resolveWithFullResponse: true,
      });
      expect(res.statusCode).toBe(200);
      let foundOrder = await models()['OrderTest'].findById(orders[0]._id);

      expect(foundOrder.tickets.length).toBe(1);
      expect(foundOrder.tickets[0].status).toBe(_const.ORDER_STATUS.WaitForAggregation);
      expect(foundOrder.tickets[0].receiver_id).toBeUndefined();


      expect(foundOrder.transaction_id).not.toBeUndefined();
      expect(foundOrder.is_collect).toBe(false);
      expect(foundOrder.is_cart).toBeFalsy();
      expect(foundOrder.address._id.toString()).toBe(utils.loggedInCustomerAddress._id.toString());

      let foundProduct = await models()['ProductTest'].findById(products[0]._id).lean();

      let newInventory1 = foundProduct.instances[0].inventory.find(x =>
        x.warehouse_id.toString() === warehouses[1]._id.toString());
      let newInventory2 = foundProduct.instances[1].inventory.find(x =>
        x.warehouse_id.toString() === warehouses[1]._id.toString());

      expect(newInventory1.count).toBe(PreInventory1.count);
      expect(newInventory2.count).toBe(PreInventory2.count);

      expect(newInventory1.reserved).toBe(PreInventory1.reserved + 2);
      expect(newInventory2.reserved).toBe(PreInventory2.reserved + 1);

      done();
    } catch (err) {
      lib.helpers.errorHandler.bind(this)(err)
    };
  });

  it('login user cc checkout ', async function (done) {
    try {

    } catch (err) {
      lib.helpers.errorHandler.bind(this)(err)
    }
  });

  it('guest user cc checkout ', async function (done) {
    try {

    } catch (err) {
      lib.helpers.errorHandler.bind(this)(err)
    }
  });

  it('guest user not cc checkout ', async function (done) {
    try {

    } catch (err) {
      lib.helpers.errorHandler.bind(this)(err)
    }
  });

  it('senario 1 : a normal order (order 1) which central warehosue has inventory for ', async function (done) {
    try {
      this.done = done;
      let res = await models()['OrderTest'].findOneAndUpdate({
        _id: orders[0]._id
      }, {
          $set: {
            order_lines: [
              {
                product_price: 0,
                paid_price: 0,
                cancel: false,
                product_id: products[0]._id,
                product_instance_id: products[0].instances[0]._id,
                tickets: []
              },
              {
                product_price: 0,
                paid_price: 0,
                cancel: false,
                product_id: products[0]._id,
                product_instance_id: products[0].instances[0]._id,
                tickets: []
              },
              {
                product_price: 0,
                paid_price: 0,
                cancel: false,
                product_id: products[0]._id,
                product_instance_id: products[0].instances[1]._id,
                tickets: []
              }
            ],
          },
        }, {new: true});

      orders[0] = JSON.parse(JSON.stringify(res));
      let PreInventory1 = products[0].instances[0].inventory.find(x =>
        x.warehouse_id.toString() === warehouses[1]._id.toString());

      let PreInventory2 = products[0].instances[1].inventory.find(x =>
        x.warehouse_id.toString() === warehouses[1]._id.toString());

      res = await rp({
        method: 'POST',
        uri: lib.helpers.apiTestURL(`checkout/true`),
        body: {
          order_id: orders[0]._id,
          address: utils.loggedInCustomerAddress,
          duration_id: deliveryDurationInfo[0]._id,
          is_collect: false,
          time_slot: {
            lower_bound: 10,
            upper_bound: 18
          },

        },
        method: 'POST',
        uri: lib.helpers.apiTestURL(`checkout/true`),
        jar: customer.jar,
        json: true,
        resolveWithFullResponse: true,
      });
      expect(res.statusCode).toBe(200);
      let foundOrder = await models()['OrderTest'].findById(orders[0]._id);

      expect(foundOrder.tickets.length).toBe(1);
      expect(foundOrder.tickets[0].status).toBe(_const.ORDER_STATUS.WaitForAggregation);
      expect(foundOrder.tickets[0].receiver_id).toBeUndefined();


      expect(foundOrder.transaction_id).not.toBeUndefined();
      expect(foundOrder.is_collect).toBe(false);
      expect(foundOrder.is_cart).toBeFalsy();
      expect(foundOrder.address._id.toString()).toBe(utils.loggedInCustomerAddress._id.toString());

      let foundProduct = await models()['ProductTest'].findById(products[0]._id).lean();

      let newInventory1 = foundProduct.instances[0].inventory.find(x =>
        x.warehouse_id.toString() === warehouses[1]._id.toString());
      let newInventory2 = foundProduct.instances[1].inventory.find(x =>
        x.warehouse_id.toString() === warehouses[1]._id.toString());

      expect(newInventory1.count).toBe(PreInventory1.count);
      expect(newInventory2.count).toBe(PreInventory2.count);

      expect(newInventory1.reserved).toBe(PreInventory1.reserved + 2);
      expect(newInventory2.reserved).toBe(PreInventory2.reserved + 1);

      done();
    } catch (err) {
      lib.helpers.errorHandler.bind(this)(err)
    };
  });

  it('senario 2 : a normal order (order 2) which central warehouse does\'nt have inventory for', async function (done) {
    try {
      this.done = done;
      let orderLines = [];
      for (let i = 0; i < 5; i++) {
        orderLines.push({
          product_price: 0,
          paid_price: 0,
          cancel: false,
          product_id: products[0]._id,
          product_instance_id: products[0].instances[0]._id,
          tickets: []
        })
      }
      let res = await models()['OrderTest'].findOneAndUpdate({
        _id: orders[0]._id
      }, {
          $set: {
            order_lines
          },
        }, {new: true});

      orders[0] = JSON.parse(JSON.stringify(res));
      let preInventory1 = products[0].instances[0].inventory.find(x =>
        x.warehouse_id.toString() === warehouses[1]._id.toString());

      let preInventory2 = products[0].instances[0].inventory.find(x =>
        x.warehouse_id.toString() === warehouses[2]._id.toString());

      let preInventory3 = products[0].instances[0].inventory.find(x =>
        x.warehouse_id.toString() === warehouses[3]._id.toString());

      res = await rp({
        method: 'POST',
        uri: lib.helpers.apiTestURL(`checkout/true`),
        body: {
          order_id: orders[0]._id,
          address: utils.loggedInCustomerAddress,
          duration_id: deliveryDurationInfo[0]._id,
          is_collect: false,
          time_slot: {
            lower_bound: 10,
            upper_bound: 18
          },

        },
        method: 'POST',
        uri: lib.helpers.apiTestURL(`checkout/true`),
        jar: customer.jar,
        json: true,
        resolveWithFullResponse: true,
      });
      expect(res.statusCode).toBe(200);

      let foundProduct = await models()['ProductTest'].findById(products[0]._id).lean();

      let newInventory1 = foundProduct.instances[0].inventory.find(x =>
        x.warehouse_id.toString() === warehouses[1]._id.toString());
      let newInventory2 = foundProduct.instances[1].inventory.find(x =>
        x.warehouse_id.toString() === warehouses[1]._id.toString());

      expect(newInventory1.count).toBe(PreInventory1.count);
      expect(newInventory2.count).toBe(PreInventory2.count);

      expect(newInventory1.reserved).toBe(PreInventory1.reserved + 2);
      expect(newInventory2.reserved).toBe(PreInventory2.reserved + 1);

      done();
    } catch (err) {
      lib.helpers.errorHandler.bind(this)(err)
    };
  });

  xit('senario 3 : c&c order (order 3) from paladium where has inventory for', async function (done) {
    try {
      this.done = done;

      let PreCentralInventory = products[0].instances[0].inventory.find(x =>
        x.warehouse_id.toString() === warehouses[1]._id.toString());

      let PrePaladiumInventory = products[0].instances[0].inventory.find(x =>
        x.warehouse_id.toString() === warehouses[2]._id.toString());

      let transaction_id = mongoose.Types.ObjectId();
      let res = await rp({
        method: 'POST',
        uri: lib.helpers.apiTestURL(`checkoutDemo`),
        body: {
          order_id: orders[2]._id,
          address: warehouses[2].address, // paladium
          transaction_id,
          used_point: 0,
          used_balance: 0,
          total_amount: 0,
          is_collect: true,
        },
        json: true,
        resolveWithFullResponse: true,
        jar: customer.jar
      });
      expect(res.statusCode).toBe(200);

      let foundOrder = await models()['OrderTest'].findById(orders[2]._id);
      expect(foundOrder.transaction_id.toString()).toBe(transaction_id.toString());
      expect(foundOrder.is_collect).toBe(true);
      expect(foundOrder.is_cart).toBeFalsy();
      expect(foundOrder.address._id.toString()).toBe(warehouses[2].address._id.toString());

      expect(foundOrder.tickets.length).toBe(1);
      expect(foundOrder.tickets[0].status).toBe(_const.ORDER_STATUS.WaitForAggregation);
      expect(foundOrder.tickets[0].receiver_id).toBeUndefined();


      let foundProduct = await models()['ProductTest'].findById(products[0]._id).lean();

      let newCentralInventory = foundProduct.instances[0].inventory.find(x =>
        x.warehouse_id.toString() === warehouses[1]._id.toString());

      let newPaladiumInventory = foundProduct.instances[0].inventory.find(x =>
        x.warehouse_id.toString() === warehouses[2]._id.toString());

      // central warehouse must not be included in c&c orders
      expect(newCentralInventory.count).toBe(PreCentralInventory.count);
      expect(newCentralInventory.reserved).toBe(PreCentralInventory.reserved);

      expect(newPaladiumInventory.count).toBe(PrePaladiumInventory.count);
      expect(newPaladiumInventory.reserved).toBe(PrePaladiumInventory.reserved + 2);

      done();
    } catch (err) {
      lib.helpers.errorHandler.bind(this)(err)
    };
  });

  xit('senario 4 : c&c order (order 4) from paladium where doesn\'t have enough inventory for as well as central (provided from sana and paladium )', async function (done) {
    try {
      this.done = done;

      let PrePaladiumInventory = products[0].instances[1].inventory.find(x =>
        x.warehouse_id.toString() === warehouses[2]._id.toString());

      let PreSanaInventory = products[0].instances[1].inventory.find(x =>
        x.warehouse_id.toString() === warehouses[3]._id.toString());

      let transaction_id = mongoose.Types.ObjectId();
      let res = await rp({
        method: 'POST',
        uri: lib.helpers.apiTestURL(`checkoutDemo`),
        body: {
          order_id: orders[3]._id,
          address: warehouses[2].address, // paladium
          transaction_id,
          used_point: 0,
          used_balance: 0,
          total_amount: 0,
          is_collect: true,
        },
        json: true,
        resolveWithFullResponse: true,
        jar: customer.jar
      });
      expect(res.statusCode).toBe(200);

      let foundOrder = await models()['OrderTest'].findById(orders[3]._id);
      let foundProduct = await models()['ProductTest'].findById(products[0]._id).lean();

      let newPaladiumInventory = foundProduct.instances[1].inventory.find(x =>
        x.warehouse_id.toString() === warehouses[2]._id.toString());

      let newSanaInventory = foundProduct.instances[1].inventory.find(x =>
        x.warehouse_id.toString() === warehouses[3]._id.toString());

      expect(newPaladiumInventory.count).toBe(PrePaladiumInventory.count);
      expect(newPaladiumInventory.reserved).toBe(PrePaladiumInventory.reserved + 1);

      expect(newSanaInventory.count).toBe(PreSanaInventory.count);
      expect(newSanaInventory.reserved).toBe(PreSanaInventory.reserved + 1);

      done();
    } catch (err) {
      lib.helpers.errorHandler.bind(this)(err)
    };
  });


});
