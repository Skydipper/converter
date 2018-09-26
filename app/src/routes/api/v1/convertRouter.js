'use strict';

const Router = require('koa-router');
const logger = require('logger');
const ConverterService = require('services/converterService');
const SQLService = require('services/sqlService');
const ResultSerializer = require('serializers/resultSerializer');
const Sql2json = require('sql2json').sql2json;
const Json2sql = require('sql2json').json2sql;
const router = new Router({
    prefix: '/api/v1/convert'
});


const hack = function (sql) {
    return sql.replace(/  +/g, ' ').replace(/\(\s\s*'/g, '(\'').replace(/\(\s\s*"/g, '("').trim();
};


class ConvertRouter {

    static convertFSObjectToQuery(fs) {
        logger.debug('Converting fs to queryparams');
        let query = '';
        if (fs) {
            let keys = Object.keys(fs);

            for (let i = 0, length = keys.length; i < length; i++) {
                if (i === 0) {
                    query += `?${keys[i]}=${fs[keys[i]]}`;
                } else {
                    query += `&${keys[i]}=${fs[keys[i]]}`;
                }
            }
        }
        return query;
    }


    static* fs2SQL() {
        logger.info('FS2SQL with sql ');
        let params = Object.assign({}, this.request.body, this.query);
        this.assert(params.tableName, 400, 'TableName is required');

        let result = yield ConverterService.fs2SQL(params);
        if (result && result.error) {
            this.throw(400, result.message);
            return;
        }
        this.body = ResultSerializer.serialize({
            query: result.query,
            jsonSql: result.parsed
        });
    }

    static* sql2FS() {
        logger.info('SQL2FS with sql ');
        let params = Object.assign({}, this.request.body, this.query);
        this.assert(params.sql, 400, 'SQL param is required');
        params.sql = hack(params.sql); // hack: TODO: fix the parser to support several spaces
        let result = yield ConverterService.sql2FS(params);
        if (result && result.error) {
            this.throw(400, result.message);
            return;
        }
        this.body = ResultSerializer.serialize({
            query: ConvertRouter.convertFSObjectToQuery(result.fs),
            fs: result.fs,
            jsonSql: result.parsed
        });
    }

    static* checkSQL() {
        logger.info('CheckSQL with sql ');
        let params = Object.assign({}, this.request.body, this.query);
        this.assert(params.sql, 400, 'SQL param is required');
        let parsed = new Sql2json(params.sql).toJSON();
        if (!parsed) {
            return SQLService.generateError('Malformed query');
        }

        let result = SQLService.checkSQL(parsed);
        if (result && result.error) {
            this.throw(400, result.message);
            return;
        }
        this.body = ResultSerializer.serialize({
            query: Json2sql.toSQL(parsed),
            jsonSql: parsed
        });
    }


    static* sql2SQL() {
        logger.info('Converting sql to sql');

        let params = Object.assign({}, this.request.body, this.query);
        this.assert(params.sql, 400, 'SQL param is required');

        let result;

        try {
            result = yield SQLService.sql2SQL(params, this.query.raster === 'true', this.query.experimental);
        } catch (err) {
            logger.error('Error converting query using sql2SQL service');
            err.status = 400;
            throw err;
        }

        if (result && result.error) {
            this.throw(400, result.message);
            return;
        }
        this.body = ResultSerializer.serialize({
            query: result.sql,
            jsonSql: result.parsed
        });
    }

    static* json2SQL() {
        logger.info('Converting json to sql');
        this.body = ResultSerializer.serialize({
            query: Json2sql.toSQL(this.request.body),
            jsonSql: this.request.body
        });
    }

}

router.get('/fs2SQL', ConvertRouter.fs2SQL);
router.post('/fs2SQL', ConvertRouter.fs2SQL);
router.get('/sql2FS', ConvertRouter.sql2FS);
router.post('/sql2FS', ConvertRouter.sql2FS);
router.get('/checkSQL', ConvertRouter.checkSQL);
router.get('/sql2SQL', ConvertRouter.sql2SQL);
router.post('/sql2SQL', ConvertRouter.sql2SQL);
router.post('/json2SQL', ConvertRouter.json2SQL);

module.exports = router;
