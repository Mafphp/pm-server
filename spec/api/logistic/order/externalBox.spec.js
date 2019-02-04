const rp = require('request-promise');
const lib = require('../../../../lib/index');
const models = require('../../../../mongo/models.mongo');
const mongoose = require('mongoose');
const _const = require('../../../../lib/const.list');
const warehouses = require('../../../../warehouses');
const utils = require('../utils');
const moment = require('moment');

describe('POST Search ScanExternalDeliveryBox', () => {

  let CWClerk = { // central warehouse clerk
    aid: null,
    jar: null,
  };

  let palladiumClerk = {
    aid: null,
    jar: null
  };

  let hubClerk = {
    aid: null,
    jar: null
  };

  let products, centralWarehouse, hubWarehouse, palladiumWarehouse;
  beforeEach(async (done) => {
    try {

      await lib.dbHelpers.dropAll();

      let warehouse = await models()['WarehouseTest'].insertMany(warehouses);
      warehouse = JSON.parse(JSON.stringify(warehouse));

      centralWarehouse = warehouse.find(x => !x.is_hub && !x.has_customer_pickup);
      hubWarehouse = warehouse.find(x => x.is_hub && !x.has_customer_pickup);

      palladiumWarehouse = warehouse.find(x => !x.is_hub && x.priority === 1);

      let res = await lib.dbHelpers.addAndLoginAgent('cwclerk', _const.ACCESS_LEVEL.ShopClerk, centralWarehouse._id);
      CWClerk.aid = res.aid;
      CWClerk.jar = res.rpJar;

      let res1 = await lib.dbHelpers.addAndLoginAgent('hubclerk', _const.ACCESS_LEVEL.HubClerk, hubWarehouse._id);
      hubClerk.aid = res1.aid;
      hubClerk.jar = res1.rpJar;

      let res2 = await lib.dbHelpers.addAndLoginAgent('pclerk', _const.ACCESS_LEVEL.ShopClerk, palladiumWarehouse._id);
      palladiumClerk.aid = res2.aid;
      palladiumClerk.jar = res2.rpJar;


      products = await models()['ProductTest'].insertMany([
        {
          name: 'sample 1',
          base_price: 30000,
          article_no: "ar123",
          instances: [
            {
              size: "9",
              price: 2000,
              barcode: '0394081341',
            },
            {
              size: "10",
              price: 2000,
              barcode: '0394081342',
            }
          ]
        }
      ]);

      done()
    }
    catch (err) {
      console.log(err);
    }
  }, 15000);

  it('should get cc order line which is in its destination (palladium warehouse which two order lines had canceled)', async function (done) {
    try {
      this.done = done;

      let orders = [];

      orders.push({
        customer_id: mongoose.Types.ObjectId(),
        is_cart: false,
        transaction_id: "xyz12213",
        order_lines: [],
        is_collect: true,
        order_time: moment(),
        address: {
          _id: mongoose.Types.ObjectId(),
          city: "تهران",
          street: "مقدس اردبیلی",
          province: "تهران",
          warehouse_name: "پالادیوم",
          warehouse_id: palladiumWarehouse._id,
          recipient_first_name: "s",
          recipient_surname: "v",
          recipient_national_id: "8798789798",
          recipient_mobile_no: "09124077685",
        },
        tickets: [
          {
            is_processed: false,
            status: _const.ORDER_STATUS.WaitForAggregation,
            desc: null,
            receiver_id: palladiumWarehouse._id,
            timestamp: moment()
          }
        ]
      });

      for (let i = 0; i < 3; i++) { // add 3 order line of first product for order 1
        orders[0].order_lines.push({
          paid_price: 0,
          product_id: products[0].id,
          product_instance_id: products[0].instances[0].id,
          adding_time: moment(),
          tickets: [
            {
              is_processed: false,
              status: _const.ORDER_LINE_STATUS.ReadyToDeliver,
              desc: null,
              receiver_id: palladiumWarehouse._id,
              timestamp: moment()
            }
          ]
        })
      }
      for (let i = 0; i < 2; i++) { // add 2 order line of second product instance for order 1
        orders[0].order_lines.push({
          paid_price: 0,
          product_id: products[0].id,
          product_instance_id: products[0].instances[1].id,
          adding_time: moment(),
          tickets: [
            {
              is_processed: false,
              status: _const.ORDER_LINE_STATUS.Recieved,
              desc: null,
              receiver_id: palladiumWarehouse._id,
              timestamp: moment()
            }
          ]
        })
      }

      orders.push({
        customer_id: mongoose.Types.ObjectId(),
        is_cart: false,
        transaction_id: "xyz12214",
        order_lines: [],
        is_collect: true,
        order_time: moment(),
        address: {
          _id: mongoose.Types.ObjectId(),
          city: "تهران",
          street: "مقدس اردبیلی",
          province: "تهران",
          warehouse_name: "پالادیوم",
          warehouse_id: palladiumWarehouse._id,
          recipient_first_name: "s",
          recipient_surname: "v",
          recipient_national_id: "8798789798",
          recipient_mobile_no: "09124077685",
        },
        tickets: [
          {
            is_processed: false,
            status: _const.ORDER_STATUS.WaitForInvoice,
            desc: null,
            receiver_id: palladiumWarehouse._id,
            timestamp: moment()
          }
        ]
      });

      for (let i = 0; i < 2; i++) { // add 2 order line of first product instance for order 2
        orders[1].order_lines.push({
          paid_price: 0,
          product_id: products[0].id,
          product_instance_id: products[0].instances[0].id,
          adding_time: moment(),
          cancel: true,
          tickets: [
            {
              is_processed: false,
              status: _const.ORDER_LINE_STATUS.FinalCheck,
              desc: null,
              receiver_id: palladiumWarehouse._id,
              timestamp: moment()
            }
          ]
        })
      }

      for (let i = 0; i < 2; i++) { // add 2 order line of second product instance for order 2
        orders[1].order_lines.push({
          paid_price: 0,
          product_id: products[0].id,
          product_instance_id: products[0].instances[1].id,
          adding_time: moment(),
          cancel: false,
          tickets: [
            {
              is_processed: false,
              status: _const.ORDER_LINE_STATUS.Checked,
              desc: null,
              receiver_id: palladiumWarehouse._id,
              timestamp: moment()
            }
          ]
        })
      }

      orders = await models()['OrderTest'].insertMany(orders);
      orders = JSON.parse(JSON.stringify(orders));

      let res = await rp({
        method: 'post',
        uri: lib.helpers.apiTestURL(`search/Ticket`),
        body: {
          options: {
            type: 'ScanExternalDelivery',
          },
          offset: 0,
          limit: 10,
          hubWarehouse
        },
        json: true,
        jar: palladiumClerk.jar,
        resolveWithFullResponse: true
      });
      expect(res.statusCode).toBe(200);
      expect(res.body.data.length).toBe(2);
      expect(res.body.data[0].total_order_lines).toBe(2);
      expect(res.body.data[1].total_order_lines).toBe(5);
      console.log(res.body.data);
      done();
    } catch (err) {
      lib.helpers.errorHandler.bind(this)(err);
    }
  });

  it('should get order line which is in hub and not cc ', async function (done) {
    try {
      this.done = done;

      let orders = [];

      orders.push({
        customer_id: mongoose.Types.ObjectId(),
        is_cart: false,
        transaction_id: "xyz12213",
        order_lines: [],
        is_collect: false,
        order_time: moment(),
        tickets: [
          {
            is_processed: false,
            status: _const.ORDER_STATUS.WaitForAggregation,
            desc: null,
            receiver_id: hubWarehouse._id,
            timestamp: moment()
          }
        ]
      });

      for (let i = 0; i < 3; i++) { // add 3 order line of first product for order 1
        orders[0].order_lines.push({
          paid_price: 0,
          product_id: products[0].id,
          product_instance_id: products[0].instances[0].id,
          adding_time: moment(),
          tickets: [
            {
              is_processed: false,
              status: _const.ORDER_LINE_STATUS.ReadyToDeliver,
              desc: null,
              receiver_id: hubWarehouse._id,
              timestamp: moment()
            }
          ]
        })
      }
      for (let i = 0; i < 2; i++) { // add 2 order line of second product instance for order 1
        orders[0].order_lines.push({
          paid_price: 0,
          product_id: products[0].id,
          product_instance_id: products[0].instances[1].id,
          adding_time: moment(),
          tickets: [
            {
              is_processed: false,
              status: _const.ORDER_LINE_STATUS.Recieved,
              desc: null,
              receiver_id: hubWarehouse._id,
              timestamp: moment()
            }
          ]
        })
      }

      orders.push({
        customer_id: mongoose.Types.ObjectId(),
        is_cart: false,
        transaction_id: "xyz12214",
        order_lines: [],
        is_collect: true,
        order_time: moment(),
        tickets: [
          {
            is_processed: false,
            status: _const.ORDER_STATUS.WaitForInvoice,
            desc: null,
            receiver_id: hubWarehouse._id,
            timestamp: moment()
          }
        ]
      });

      for (let i = 0; i < 2; i++) { // add 2 order line of first product instance for order 2
        orders[1].order_lines.push({
          paid_price: 0,
          product_id: products[0].id,
          product_instance_id: products[0].instances[0].id,
          adding_time: moment(),
          cancel: false,
          tickets: [
            {
              is_processed: false,
              status: _const.ORDER_LINE_STATUS.FinalCheck,
              desc: null,
              receiver_id: palladiumWarehouse._id,
              timestamp: moment()
            }
          ]
        })
      }

      for (let i = 0; i < 2; i++) { // add 2 order line of second product instance for order 2
        orders[1].order_lines.push({
          paid_price: 0,
          product_id: products[0].id,
          product_instance_id: products[0].instances[1].id,
          adding_time: moment(),
          cancel: false,
          tickets: [
            {
              is_processed: false,
              status: _const.ORDER_LINE_STATUS.checked,
              desc: null,
              receiver_id: palladiumWarehouse._id,
              timestamp: moment()
            }
          ]
        })
      }

      orders = await models()['OrderTest'].insertMany(orders);
      orders = JSON.parse(JSON.stringify(orders));

      let res = await rp({
        method: 'post',
        uri: lib.helpers.apiTestURL(`search/Ticket`),
        body: {
          options: {
            type: 'ScanExternalDelivery',
          },
          offset: 0,
          limit: 10,
          hubWarehouse
        },
        json: true,
        jar: hubClerk.jar,
        resolveWithFullResponse: true
      });
      expect(res.statusCode).toBe(200);
      expect(res.body.data.length).toBe(1);
      expect(res.body.data[0].total_order_lines).toBe(5);

      done();
    } catch (err) {
      lib.helpers.errorHandler.bind(this)(err);
    }
  });

});


describe('POST Order Ticket Scan - multiple triggers', () => {
  let orders, products, deliveries, customer;

  let hubClerk = {
    aid: null,
    jar: null,
  };
  customer = {
    _id: null,
    jar: null,
  }


  beforeEach(async done => {
    try {
      await lib.dbHelpers.dropAll()
      await models()['WarehouseTest'].insertMany(warehouses)
      hub = warehouses.find(x => x.is_hub);
      const agent = await lib.dbHelpers.addAndLoginAgent('hclerk', _const.ACCESS_LEVEL.HubClerk, hub._id)
      hubClerk.aid = agent.aid;
      hubClerk.jar = agent.rpJar;

      const customerobj = await lib.dbHelpers.addAndLoginCustomer('s@s.com', '123456', {
        first_name: 'Sareh',
        surname: 'Salehi'
      })
      customer._id = customerobj.cid,
        customer.jar = customerobj.jar
      products = await utils.makeProducts();
      orders = await utils.makeOrders(customer);

      await models()['OrderTest'].update({
        _id: mongoose.Types.ObjectId(orders[1]._id),
      }, {
        $set: {
          order_lines: [{
            product_id: products[0]._id,
            campaign_info: {
              _id: mongoose.Types.ObjectId(),
              discount_ref: 0
            },
            product_instance_id: products[0].instances[0]._id,
            tickets: [{
              is_processed: false,
              status: _const.ORDER_LINE_STATUS.FinalCheck,
              receiver_id: warehouses.find(x => x.is_hub)._id,
              desc: null,
              timestamp: new Date(),
            }]
          }, {
            product_id: products[0]._id,
            campaign_info: {
              _id: mongoose.Types.ObjectId(),
              discount_ref: 0
            },
            product_instance_id: products[0].instances[0]._id,
            tickets: [{
              is_processed: false,
              status: _const.ORDER_LINE_STATUS.FinalCheck,
              receiver_id: warehouses.find(x => x.is_hub)._id,
              desc: null,
              timestamp: new Date(),
            }]
          }],
          delivery_info: {
            duration_days: 3,
            delivery_cost: 63000,
            delivery_discount: 0,
            delivery_expire_day: new Date(),
            time_slot: {
              lower_bound: 10,
              upper_bound: 14,
            }
          }
        }
      });
      done();
    } catch (err) {
      console.log(err);
    }
    ;
  }, 15000);
  it('should scan prduct barcode for External delivery for final and change its ticket to checked', async function (done) {
    try {
      this.done = done
      const res = await rp({
        jar: hubClerk.jar,
        body: {
          trigger: _const.SCAN_TRIGGER.SendExternal,
          orderId: orders[1]._id,
          barcode: '0394081341'
        },
        method: 'POST',
        json: true,
        uri: lib.helpers.apiTestURL('order/ticket/scan'),
        resolveWithFullResponse: true
      });

      expect(res.statusCode).toBe(200)
      const orderData = await models()['OrderTest'].find()
      const order = orderData.find(o => o.order_lines.length)
      expect(order.order_lines[0].tickets[order.order_lines[0].tickets.length - 1].status).toBe(_const.ORDER_LINE_STATUS.Checked)
      done()
    } catch (err) {
      lib.helpers.errorHandler.bind(this)(err)
    }
    ;
  });

  it('should scan product barcode for External delivery and change order ticket to waitforinvoice and OL ticket to checked', async function (done) {
    try {
      this.done = done

      const orderData0 = await models()['OrderTest'].find()
      orderData0[1].order_lines[1].tickets[orderData0[1].order_lines[1].tickets.length - 1].status = _const.ORDER_LINE_STATUS.Checked
      await orderData0[1].save()
      const res = await rp({
        jar: hubClerk.jar,
        body: {
          trigger: _const.SCAN_TRIGGER.SendExternal,
          orderId: orders[1]._id,
          barcode: '0394081341'
        },
        method: 'POST',
        json: true,
        uri: lib.helpers.apiTestURL('order/ticket/scan'),
        resolveWithFullResponse: true
      });

      expect(res.statusCode).toBe(200)
      const orderData = await models()['OrderTest'].find()
      const order = orderData.find(o => o.order_lines.length)
      order.order_lines.forEach(ol => {
        expect(ol.tickets[ol.tickets.length - 1].status).toBe(_const.ORDER_LINE_STATUS.Checked)
      });
      expect(order.tickets[order.tickets.length - 1].status).toBe(_const.ORDER_STATUS.WaitForInvoice)
      done()
    } catch (err) {
      lib.helpers.errorHandler.bind(this)(err)
    }
    ;

  });

});


