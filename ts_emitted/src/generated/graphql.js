"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TimeFrame = exports.SortType = exports.SortDirection = exports.RepeatUnit = void 0;
var RepeatUnit;
(function (RepeatUnit) {
    RepeatUnit["Day"] = "DAY";
    RepeatUnit["Month"] = "MONTH";
    RepeatUnit["Week"] = "WEEK";
    RepeatUnit["Year"] = "YEAR";
})(RepeatUnit || (exports.RepeatUnit = RepeatUnit = {}));
/** An enum for sorting in either ascending or descending order. */
var SortDirection;
(function (SortDirection) {
    /** Sort by field values in ascending order. */
    SortDirection["Asc"] = "ASC";
    /** Sort by field values in descending order. */
    SortDirection["Desc"] = "DESC";
})(SortDirection || (exports.SortDirection = SortDirection = {}));
var SortType;
(function (SortType) {
    SortType["Hot"] = "hot";
    SortType["New"] = "new";
    SortType["Top"] = "top";
})(SortType || (exports.SortType = SortType = {}));
var TimeFrame;
(function (TimeFrame) {
    TimeFrame["All"] = "all";
    TimeFrame["Day"] = "day";
    TimeFrame["Month"] = "month";
    TimeFrame["Week"] = "week";
    TimeFrame["Year"] = "year";
})(TimeFrame || (exports.TimeFrame = TimeFrame = {}));
