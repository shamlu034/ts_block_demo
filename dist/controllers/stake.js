"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.StakeController = void 0;
const tsoa_1 = require("tsoa");
const mysqlQueryBuilder_1 = require("../utils/mysqlQueryBuilder");
let StakeController = class StakeController extends tsoa_1.Controller {
    getStakes() {
        return __awaiter(this, void 0, void 0, function* () {
            return mysqlQueryBuilder_1.queryBuilder.select({
                table: 'stakes',
                where: { amount: { '>': 0 } }, // 金额大于 0
                orderBy: { field: 'amount', direction: 'DESC' },
                limit: { count: 100 },
                joins: [
                    {
                        type: 'LEFT',
                        table: 'users',
                        on: { left: 'stakes.address', right: 'users.address' },
                    },
                ],
                fields: ['stakes.address', 'stakes.amount', 'users.name'],
            });
        });
    }
    getTotalStaked() {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            const rows = yield mysqlQueryBuilder_1.queryBuilder.select({
                table: 'stakes',
                where: { amount: { '>': 0 } },
                fields: 'SUM(amount) as total',
                groupBy: 'address',
            });
            return { total: ((_a = rows[0]) === null || _a === void 0 ? void 0 : _a.total) || '0' };
        });
    }
};
exports.StakeController = StakeController;
__decorate([
    (0, tsoa_1.Get)('/'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], StakeController.prototype, "getStakes", null);
__decorate([
    (0, tsoa_1.Get)('/total'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], StakeController.prototype, "getTotalStaked", null);
exports.StakeController = StakeController = __decorate([
    (0, tsoa_1.Route)('stakes')
], StakeController);
