const rp = require('request-promise');
const lib = require('../../../../lib/index');
const models = require('../../../../mongo/models.mongo');
const mongoose = require('mongoose');
const _const = require('../../../../lib/const.list');
const warehouses = require('../../../../warehouses');
const utils = require('../utils');
const moment = require('moment');

describe('POST Search on Delivery Items', () => {

  let orders, products, deliveries;
  let hubClerk = {
    aid: null,
    jar: null
  };

  let agentObj = {
    aid: null,
    jar: null
  };

  let customer = {
    _id: null,
    jar: null,
  };

  beforeEach(async done => {
    try {
      await lib.dbHelpers.dropAll();

      await models()['WarehouseTest'].insertMany(warehouses);

      let hubWarehouse = warehouses.find(x => x.is_hub && !x.has_customer_pickup);

      const hub = await lib.dbHelpers.addAndLoginAgent('hclerk', _const.ACCESS_LEVEL.HubClerk, hubWarehouse._id);
      hubClerk.aid = hub.aid;
      hubClerk.jar = hub.rpJar;

      const agent = await lib.dbHelpers.addAndLoginAgent('IDelivery Agent', _const.ACCESS_LEVEL.InternalDeliveryAgent);
      agentObj.aid = agent.aid;
      agentObj.jar = agent.rpJar;

      const customerobj = await lib.dbHelpers.addAndLoginCustomer('s@s.com', '123456', {
        first_name: 'S',
        surname: 'V'
      });
      customer._id = customerobj.cid;
      customer.jar = customerobj.jar;

      products = await utils.makeProducts();
      orders = await utils.makeOrders(customer);
      await models()['OrderTest'].update({
        _id: mongoose.Types.ObjectId(orders[0]._id),
      }, {
        $set: {
          order_lines: {
            product_id: mongoose.Types.ObjectId(products[0]._id),
            campaign_info: {
              _id: mongoose.Types.ObjectId(),
              discount_ref: 0
            },
            product_instance_id: mongoose.Types.ObjectId(products[0].instances[0]._id),
            tickets: []
          },
          tickets: [{
            is_processed: false,
            status: _const.ORDER_STATUS.DeliverySet,
            desc: null,
            receiver_id: mongoose.Types.ObjectId(),
            timestamp: new Date()
          }]
        }
      });
      await models()['OrderTest'].update({
        _id: mongoose.Types.ObjectId(orders[1]._id),
      }, {
        $set: {
          order_lines: {
            product_id: mongoose.Types.ObjectId(products[0]._id),
            campaign_info: {
              _id: mongoose.Types.ObjectId(),
              discount_ref: 0
            },
            product_instance_id: mongoose.Types.ObjectId(products[0].instances[0]._id),
            tickets: []
          },
          tickets: [{
            is_processed: false,
            status: _const.ORDER_STATUS.DeliverySet,
            desc: null,
            receiver_id: mongoose.Types.ObjectId(),
            timestamp: new Date()
          }]
        }
      });
      const orderData = await models()['OrderTest'].find()
      deliveries = await models()['DeliveryTest'].insertMany([
        {
          to: {
            customer: {
              _id: orderData[0].customer_id,
              address: orderData[0].address
            }
          },
          from: {
            warehouse_id: warehouses.find(x => x.is_hub)._id
          },
          order_details: [{
            order_line_ids: [
              orderData[0].order_lines[0]._id,
            ],
            _id: mongoose.Types.ObjectId(),
            order_id: orders[0]._id

          }],
          start: new Date(),
          tickets: [{
            is_processed: false,
            _id: mongoose.Types.ObjectId(),
            status: _const.DELIVERY_STATUS.default,
            receiver_id: hubWarehouse._id,
            timestamp: new Date()
          }],
          shelf_code: 'A',
          delivery_agent: agentObj.aid,
          delivery_start: moment().toDate(),
          delivery_end: moment().add(1, 'd').toDate()
        },
      ]);
      deliveries = JSON.parse(JSON.stringify(deliveries));
      done();
    } catch (err) {
      console.log(err);
    };
  }, 15000);

  it('should see order in shelf code', async function (done) {
    this.done = done;

    const res = await rp({
      uri: lib.helpers.apiTestURL('search/DeliveryTicket'),
      method: 'POST',
      body: {
        options: {
          type: 'ShelvesList'
        },
        offset: 0,
        limit: 10
      },
      json: true,
      jar: hubClerk.jar,
      resolveWithFullResponse: true
    });

    expect(res.statusCode).toBe(200);
    expect(res.body.data.length).toBe(1);
    done();

  });
});