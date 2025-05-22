export var EventType;
(function (EventType) {
    EventType["Create"] = "CREATE";
    EventType["CreateRelationship"] = "CREATE_RELATIONSHIP";
    EventType["Delete"] = "DELETE";
    EventType["DeleteRelationship"] = "DELETE_RELATIONSHIP";
    EventType["Update"] = "UPDATE";
})(EventType || (EventType = {}));
export var RepeatUnit;
(function (RepeatUnit) {
    RepeatUnit["Day"] = "DAY";
    RepeatUnit["Month"] = "MONTH";
    RepeatUnit["Week"] = "WEEK";
    RepeatUnit["Year"] = "YEAR";
})(RepeatUnit || (RepeatUnit = {}));
/** An enum for sorting in either ascending or descending order. */
export var SortDirection;
(function (SortDirection) {
    /** Sort by field values in ascending order. */
    SortDirection["Asc"] = "ASC";
    /** Sort by field values in descending order. */
    SortDirection["Desc"] = "DESC";
})(SortDirection || (SortDirection = {}));
export var SortType;
(function (SortType) {
    SortType["Hot"] = "hot";
    SortType["New"] = "new";
    SortType["Top"] = "top";
})(SortType || (SortType = {}));
export var TimeFrame;
(function (TimeFrame) {
    TimeFrame["All"] = "all";
    TimeFrame["Day"] = "day";
    TimeFrame["Month"] = "month";
    TimeFrame["Week"] = "week";
    TimeFrame["Year"] = "year";
})(TimeFrame || (TimeFrame = {}));
