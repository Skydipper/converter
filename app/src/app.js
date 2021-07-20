const logger = require('logger');
const Koa = require('koa');
const bodyParser = require('koa-bodyparser');
const config = require('config');
const koaLogger = require('koa-logger');
const loader = require('loader');
const ErrorSerializer = require('serializers/errorSerializer');
// const { RWAPIMicroservice } = require('rw-api-microservice-node');
const ctRegisterMicroservice = require('ct-register-microservice-node');
const koaSimpleHealthCheck = require('koa-simple-healthcheck');

const app = new Koa();

app.use(koaLogger());

app.use(bodyParser({
    jsonLimit: '50mb'
}));
app.use(koaSimpleHealthCheck());

// catch errors and send in jsonapi standard. Always return vnd.api+json
app.use(async (ctx, next) => {
    try {
        await next();
    } catch (err) {
        ctx.status = err.status || 500;

        if (ctx.status >= 500) {
            logger.error(err);
        } else {
            logger.info(err);
        }
        ctx.body = ErrorSerializer.serializeError(ctx.status, err.message);
        if (process.env.NODE_ENV === 'prod' && ctx.status === 500) {
            ctx.body = 'Unexpected error';
        }
    }
    ctx.response.type = 'application/vnd.api+json';
});

// app.use(RWAPIMicroservice.bootstrap({
//     logger,
//     gatewayURL: process.env.GATEWAY_URL,
//     microserviceToken: process.env.MICROSERVICE_TOKEN,
//     fastlyEnabled: process.env.FASTLY_ENABLED,
//     fastlyServiceId: process.env.FASTLY_SERVICEID,
//     fastlyAPIKey: process.env.FASTLY_APIKEY
// }));

loader.loadRoutes(app);

// get port of environment, if not exist obtain of the config.
// In production environment, the port must be declared in environment variable
const port = config.get('service.port');

const server = app.listen(port, function () {
    ctRegisterMicroservice.register({
        info: require('../microservice/register.json'),
        swagger: require('../microservice/public-swagger.json'),
        mode: (process.env.CT_REGISTER_MODE && process.env.CT_REGISTER_MODE === 'auto') ? ctRegisterMicroservice.MODE_AUTOREGISTER : ctRegisterMicroservice.MODE_NORMAL,
        framework: ctRegisterMicroservice.KOA1,
        app,
        logger,
        name: config.get('service.name'),
        ctUrl: process.env.CT_URL,
        url: process.env.LOCAL_URL,
        active: true,
    }).then(() => {
    }, (err) => {
        logger.error(err);
        // process.exit(1);
    });
});

logger.info(`Server started in port:${port}`);

module.exports = server;
