/* eslint-disable guard-for-in,indent,no-tabs,linebreak-style */
/* eslint-disable no-restricted-syntax */
/* eslint-disable no-undef */

let isExportMode = false;
let UserSettingExportInfo = null;
let isUserSwitchedTab = true;
let previousSettingInfor = null;
let mainFormSettings = null;
let currentLoadSetting = null;
let currentFromDataFromLoadSetting = null;
let isSettingChanged = false;
let isSettingLoading = false;
const INVALID_FILTER_DETAIL_IDS = 'invalid_filter_detail_ids';
const SHARED_USER_SETTING = 'shared_user_setting';
let lastUsedFormData = null;
let latestIndexOrder = [];
let selectedHref = '';
let excludeSensors = [];
let jumpCheckedAllSensors = [];
let objectiveId = null;

const settingModals = {
    common: '#saveUserSettingModal',
    confirmation: '#saveSettingConfirmModal',
    confirmBtn: '#saveSettingConfirmed',
    mainSettingForm: '#mainContent form',
    userSetting: '#userSetting',
    saveSettingBtn: '#saveSettingBtn',
    loadSettingModal: '#loadUserSettingModal',
    overwriteSaveSettingBtn: '#overwriteSaveSettingBtn',
    currentLoadSettingLbl: '#currentLoadSettingLbl',
    overwriteConfirmation: '#overwriteSaveSettingConfirmModal',
    overwriteConfirmBtn: '#overwriteSaveSettingConfirmed',
    alertUserSettingErrorMsg: '#alertUserSettingErrorMsg',
    saveSettingConfirmBtn: '#saveSettingConfirmBtn',
    bookmarkBtn: '#bookmark-title',
    menuExport: '#contextMenuExport',
    menuImport: '#contextMenuImport',
    showGraphNow: '[name=showGraphNow]',
    loadUserSettingLabel: '#loadUserSettingLabel',
    changeSettingConfirmModal: '#changeSettingConfirmModal',
    editSettingBtn: '#editSettingBtn',
    userSettingLabel: '#userSettingLabel',
    saveUserSettingConfirmContent: '#saveSettingConfirmContent',
    sideBarContextMenu: '#contextMenuSidebar',
};

const i18nEles = {
    shared: '#i18nShared',
    private: '#i18nPrivate',
    open: '#i18nOpen',
};

const saveSettingExceptionPages = {
    TI: 'tile_interface',
    CFG: 'config',
    ABOUT: 'about',
};

const getAllTabs = (includeEle = null) => {
    const tabs = $('[name=inputTab] .tab-pane');
    if (!tabs.length) {
        return $(document);
    }

    if (includeEle) {
        for (const tab of tabs) {
            if ($(tab).find(includeEle).length) {
                return tab;
            }
        }
    }

    return tabs;
};

const getShowTab = () => {
    const showTab = $('[name=inputTab] .tab-pane.show.active');
    if (showTab.length) {
        return showTab;
    }

    return $(document);
};

const getShowFormId = () => {
    let showForm = $('[name=inputTab] .tab-pane.show.active form');
    if (showForm.length) {
        return showForm[0].id;
    }

    showForm = $('form').not('#userSetting');
    if (showForm.length) {
        return showForm[0].id;
    }

    return null;


};

const genInvalidFilterName = (procId, startDate, startTime, endDate, endTime) => [INVALID_FILTER_DETAIL_IDS, procId, startDate, startTime, endDate, endTime].join('_');

const getConditionGroups = (parentDiv) => {
    const searchGroups = $(parentDiv).find('[id*=cond-proc].grouplist-checkbox-with-search');
    return searchGroups;
};

const getNonConditionGroups = (parentDiv) => {
    const searchGroups = $(parentDiv).find('.grouplist-checkbox-with-search').not('[id*=cond-proc]');
    return searchGroups;
};

const getCheckedFilters = (parentDiv) => {
    const filterEles = $(parentDiv).find('[id$=cond-proc-row] input:checkbox:checked');
    const filterDetailIds = [];
    for (el of filterEles) {
        const val = Number(el.value);
        if (val) {
            filterDetailIds.push(val);
        }
    }
    return filterDetailIds;
};

const getFilterKeys = (parentDiv) => {
    let proc = $(parentDiv).find('select[name=start_proc] :selected').first();
    if (!proc.length) {
        proc = $(parentDiv).find('select[name^=end_proc] :selected').first();
    }

    if (!proc.length) {
        return null;
    }

    const timeRadio = $(parentDiv).find('input[type=radio][name*=raceTime]:checked');
    if (!timeRadio.length) {
        return null;
    }

    const startDates = $(parentDiv).find('input[name*=START_DATE]');
    const startTimes = $(parentDiv).find('input[name*=START_TIME]');
    const endDates = $(parentDiv).find('input[name*=END_DATE]');
    const endTimes = $(parentDiv).find('input[name*=END_TIME]');

    if (!startDates.length) {
        return null;
    }

    const keys = [];
    for (let i = 0; i < startDates.length; i++) {
        let startTime = '';
        if (startTimes && startTimes[i]) {
            startTime = startTimes[i].value;
        }

        let endDate = '';
        if (endDates && endDates[i]) {
            endDate = endDates[i].value;
        }

        let endTime = '';
        if (endTimes && endTimes[i]) {
            endTime = endTimes[i].value;
        }

        const key = genInvalidFilterName(proc.val(), startDates[i].value, startTime, endDate, endTime);
        keys.push(key);
    }

    return keys;
};

const controlInvalidFilterLifeCycle = (key) => {
    const invalidFilterKeys = JSON.parse(localStorage.getItem(INVALID_FILTER_DETAIL_IDS)) || [];
    const pos = invalidFilterKeys.indexOf(key);
    if (pos >= 0) {
        invalidFilterKeys.splice(pos, 1);
    }
    invalidFilterKeys.push(key);

    // to make sure we only hold 1000 records for all pages ( avoid full localstorage )
    const deletePos = invalidFilterKeys.length - 1000;
    for (let i = 0; i < deletePos; i++) {
        localStorage.removeItem(invalidFilterKeys[i]);
        invalidFilterKeys.splice(i, 1);
    }

    localStorage.setItem(INVALID_FILTER_DETAIL_IDS, JSON.stringify(invalidFilterKeys));
};

const saveInvalidFilters = (key, invalidFilterDetailIds) => {
    if (!invalidFilterDetailIds.length) {
        return false;
    }

    let targets = invalidFilterDetailIds;
    const ids = JSON.parse(localStorage.getItem(key)) || [];
    targets.concat(ids);
    targets = uniq(targets);
    localStorage.setItem(key, JSON.stringify(targets));
    controlInvalidFilterLifeCycle(key);
    return true;
};

const removeInvalidFilters = (key, invalidFilterDetailIds) => {
    if (!invalidFilterDetailIds.length) {
        return false;
    }

    const ids = JSON.parse(localStorage.getItem(key)) || [];
    for (let j = 0; j < invalidFilterDetailIds.length; j++) {
        const pos = ids.indexOf(invalidFilterDetailIds[j]);
        if (pos >= 0) {
            ids.splice(pos, 1);
        }
    }
    localStorage.setItem(key, JSON.stringify(ids));
    controlInvalidFilterLifeCycle(key);
    return true;
};


const getInvalidFilters = (key) => {
    const data = JSON.parse(localStorage.getItem(key)) || [];
    return data;
};

const getSortKeys = (targetEle, isSimple = null) => {
    const lastPosNumber = 9999;
    const keys = [];
    const liGrey = $(targetEle).hasClass('li-grey');
    const liBlue = $(targetEle).hasClass('li-blue');
    const columnName = $(targetEle).find('.column-master-name');
    const cycleTimeCol = $(targetEle).find('.data-type');
    const facetSelect = $(targetEle).find('select');
    const facetLevel = facetSelect.length > 0 && facetSelect.val() !== '' ? Number(facetSelect.val()) : lastPosNumber;
    const checkboxs = $(targetEle).find('input:checkbox,input:radio');
    const val = checkboxs.length === 0 ? lastPosNumber : checkboxs[0].value;
    const sensorOrder = checkboxs.length > 0 ? Number($(checkboxs[0]).attr('data-order')) : null;
    const isChecked = !!(checkboxs.length > 0 && checkboxs[0].checked);
    const isColumnNameBlank = !!(columnName.length > 0 && columnName.text() === '');
    // order by sensor x, y
    const sensor = checkboxs.length > 0 ? $(checkboxs[0]).attr('data-sensor') : null;
    const order = checkboxs.length > 0 && isChecked ? $(checkboxs[0]).attr('order') : null;

    if (val === 'NO_FILTER') {
        keys.push(0);
    } else if (val === 'All') {
        keys.push(1);
    } else {
        keys.push(2);
    }

    if (isSimple) {
        keys.push(isChecked === null ? lastPosNumber : (isChecked ? 0 : 1));
        return keys;
    }

    if (order) {
        keys.push(order);
    }

    let cycleTimeVal = lastPosNumber;
    if (cycleTimeCol.length > 0) {
        if (cycleTimeCol.text().includes('CT')) {
            if (isChecked) {
                cycleTimeVal = isColumnNameBlank ? 0 : 1;
            }
        }
    }
    keys.push(cycleTimeVal);
    if (sensorOrder) {
        if (sensor && sensor === 'x') {
            keys.push(0);
        } else if (sensor && sensor === 'y') {
            keys.push(0.1);
        } else {
            keys.push(isChecked === null ? lastPosNumber : (isChecked ? 0 : 1));
        }
        keys.push(facetLevel);
    } else {
        keys.push(facetLevel);
        keys.push(isChecked === null ? lastPosNumber : (isChecked ? 0 : 1));
    }
    keys.push(liGrey ? 2 : (liBlue ? 1 : 0));
    keys.push(checkboxs.length >= 2 ? (checkboxs[1].checked ? 0 : 1) : 2);
    keys.push(cycleTimeVal);
    // keys.push(Number(val));

    return keys;
};

const sortHtmlElements = (parentEle, isSimple = null) => {
    let isChanged = false;
    const ul = $(parentEle);
    const items = ul.find('.list-group-item').get();
    items.sort((a, b) => {
        const aKeys = getSortKeys(a, isSimple);
        const bKeys = getSortKeys(b, isSimple);

        for (let i = 0; i < aKeys.length; i++) {
            const keyA = aKeys[i];
            const keyB = bKeys[i];
            if (keyA < keyB) {
                isChanged = true;
                return -1;
            }
            if (keyA > keyB) return 1;
        }
        return 0;
    });

    $.each(items, (i, li) => {
        ul.append(li);
    });
    return isChanged;
};

const moveFilter = (searchGroup, invalidFilterDetailIds, onlyCheckedFilter = true) => {
    const items = $(searchGroup).find('.list-group-item');
    for (e of items) {
        const ele = $(e);
        if (!ele) {
            continue;
        }

        let filterEle;
        if (onlyCheckedFilter) {
            filterEle = ele.find('input:checkbox:checked');
        } else {
            filterEle = ele.find('input:checkbox');
        }

        if (filterEle.length) {
            if (invalidFilterDetailIds.indexOf(Number(filterEle[0].value)) >= 0) {
                if (!ele.hasClass('li-grey')) {
                    ele.addClass('li-grey');
                }
            } else if (ele.hasClass('li-grey')) {
                ele.removeClass('li-grey');
            }
        }
    }

    sortHtmlElements(searchGroup);
};

const loadAllInvalidFilterCaller = (parentDiv, isTab = true) => {
    const conditionGroups = getConditionGroups(parentDiv);
    const currentTab = isTab ? parentDiv : getAllTabs(parentDiv);
    const keys = getFilterKeys(currentTab) || [];
    for (const invalidKey of keys) {
        const invalidFilters = getInvalidFilters(invalidKey);
        conditionGroups.each((i, e) => moveFilter(e, invalidFilters, false));
    }
};

const setColorAndSortHtmlEle = (matchedIds, unmatchedIds, otherIds) => {
    const showTab = getShowTab();
    const searchGroups = getConditionGroups(showTab);

    for (const searchGroup of searchGroups) {
        const items = $(searchGroup).find('.list-group-item');
        for (e of items) {
            const ele = $(e);
            if (!ele) {
                continue;
            }

            const filterEle = ele.find('input:checkbox');

            if (!filterEle.length) {
                continue;
            }

            const filterDetailId = Number(filterEle[0].value);
            if (!filterDetailId) {
                continue;
            }
            if (matchedIds && matchedIds.includes(filterDetailId)) {
                ele.removeClass('li-grey');
            } else if (unmatchedIds && unmatchedIds.includes(filterDetailId)) {
                ele.addClass('li-grey');
            } else if (otherIds && otherIds.includes(filterDetailId)) {
                ele.addClass('li-blue');
            }
        }

        sortHtmlElements(searchGroup);
    }

    // sort element
    const otherGroups = getNonConditionGroups(showTab);
    for (const otherGroup of otherGroups) {
        sortHtmlElements(otherGroup);
    }
};
const saveInvalidFilterCaller = (isRemove = false) => {
    const showTab = getShowTab();
    const searchGroups = getConditionGroups(showTab);
    const keys = getFilterKeys(showTab) || [];
    const invalidFilters = getCheckedFilters(showTab);

    if (isRemove) {
        for (const invalidKey of keys) {
            removeInvalidFilters(invalidKey, invalidFilters);
            searchGroups.each((i, e) => moveFilter(e, []));
        }
    } else {
        for (const invalidKey of keys) {
            saveInvalidFilters(invalidKey, invalidFilters);
            searchGroups.each((i, e) => moveFilter(e, invalidFilters));
        }
    }

    // sort element
    const otherGroups = getNonConditionGroups(showTab);
    for (const otherGroup of otherGroups) {
        sortHtmlElements(otherGroup);
    }
};

const setTriggerInvalidFilter = (parentDiv) => {
    let proc = $(parentDiv).find('select[name=start_proc]').first();
    if (!proc.length) {
        proc = $(parentDiv).find('select[name^=end_proc]').first();
    }

    const timeRadio = $(parentDiv).find('input[type=radio][name*=raceTime]:checked');
    const startDates = $(parentDiv).find('input[name*=START_DATE]');
    const startTimes = $(parentDiv).find('input[name*=START_TIME]');
    const endDates = $(parentDiv).find('input[name*=END_DATE]');
    const endTimes = $(parentDiv).find('input[name*=END_TIME]');

    for (const ele of [proc, timeRadio, startDates, startTimes, endDates, endTimes]) {
        ele.on('change', (_) => {
            const showTab = getShowTab();
            loadAllInvalidFilterCaller(showTab);
        });
    }
};

const checkResultExist = (res) => {
    if (res.times !== undefined) {
        if (res.times.length > 0) {
            return true;
        }
        return false;
    }

    const plotDatas = res.array_plotdata || {};
    for (const plot of Object.values(plotDatas)) {
        if (plot.array_y && plot.array_y.length > 0) {
            return true;
        }
    }

    return false;
};

// ////////////////////////////////////////
const saveLoadUserInput = (selector, localStorageKeyPrefix = '', parent = '', localStorageKey = null, isLoadNew = true) => {
    const DYNAMIC_ELE_ATTR = 'data-gen-btn';

    const buildEleSelector = (name, value = null, id = null) => {
        let output = '';
        if (parent) {
            output += `#${parent} `;
        }

        if (id) {
            output += `#${id}`;
        }

        if (name) {
            output += `[name=${name}]`;
        }
        if (value) {
            output += `[value=${value}]`;
        }

        return output;
    };

    let formId;
    let form;
    if (typeof (selector) === 'string') {
        if (!selector.replace('#', '')) return () => {
        };
        form = document.querySelector(selector);
        // form does not exist
        if (!form) {
            // find a form in document ( maybe GUI changed )
            form = $('form').not('#userSetting');
            if (!form) {
                return;
            }
            form = form[0];
        }
        formId = form.getAttribute('id');
    } else {
        form = selector;
        formId = selector.id || '';
    }

    if (formId === 'userSetting') {
        return;
    }

    let key;
    if (localStorageKey) {
        key = localStorageKey;
    } else {
        key = `${localStorageKeyPrefix}_${formId}_saveUserInput`;
    }
    const elements = form.querySelectorAll('input, textarea, select');
    const tabPanes = document.querySelectorAll('.tab-pane');

    const checkActiveTab = (el) => {
        return el.classList.contains('tab-pane') && el.classList.contains('active') && el.classList.contains('show');
    };


    const serializeArray = () => {
        const serializeData = [];

        elements.forEach((el) => {
            const data = {
                id: el.id, name: el.name, value: el.value || $(el).val(), type: el.type,
            };
            // load level
            const loadLevel = $(el).data('load-level');
            if (loadLevel) {
                data.level = loadLevel;
            }

            // only match
            if (el.type === 'radio' || el.type === 'checkbox') {
                if (data.name === 'objectiveVar' && objectiveId) {
                     if (data.id === objectiveId) {
                        data.checked = true;
                    } else if (data.id !== objectiveId) {
                        data.checked = false;
                    }
                } else if (/GET02_VALS_SELECT/.test(data.name)) {
                    if (jumpCheckedAllSensors.length && jumpCheckedAllSensors.includes(data.value)) {
                        data.checked = true;
                    } else if ((jumpCheckedAllSensors.length && !jumpCheckedAllSensors.includes(data.value)) || excludeSensors.includes(data.value)) {
                        data.checked = false;
                    } else {
                        data.checked = el.checked;
                    }
                } else {
                    data.checked = el.checked;
                }
            } else if (el.getAttribute(DYNAMIC_ELE_ATTR)) {
                // dynamic generate div
                data.genBtnId = el.getAttribute(DYNAMIC_ELE_ATTR);
            }

            if (data.id === 'datetimeRangePicker' && data.name === 'DATETIME_RANGE_PICKER' && divideOption === divideOptions.cyclicTerm) {
                // assign new data
                serializeData.push({
                    id: 'cyclicTermDatetimePicker',
                    name: 'DATETIME_PICKER',
                    type: 'text',
                    value: data.value.split(DATETIME_PICKER_SEPARATOR)[0],
                });
            }

            serializeData.push(data);

        });

        if (divideOption) {
            serializeData.push({
                id: "divideOption",
                name: "compareType",
                type: "select-one",
                value: divideOption,
            })
        }

        resetCommonJumpObj();

        tabPanes.forEach((el) => {
            const data = {
                id: el.id, name: el.name, value: el.value, type: el.type, isActiveTab: checkActiveTab(el),
            };
            serializeData.push(data);
        });

        // sort checked judge
        const checkedJudge = serializeData.filter(setting => setting.name === 'judgeVar' && setting.checked === true);
        if (checkedJudge.length) {
            serializeData.push(checkedJudge[0]);
        }

        return serializeData;
    };

    const saveUserInput = () => {
        const formData = JSON.stringify(serializeArray());
        localStorage.setItem(key, formData);
    };

    // call all event of element
    const callAllEvent = (ele, events = ['change']) => {
        // const events = window.getEventListeners(ele);
        // for (eventName in events) {
        //     events[eventName].forEach(e => e.listener.call());
        // }

        for (const eventName of events) {
            try {
                $(ele).trigger(eventName);
            } catch (error) {
                continue;
            }
        }
    };

    // check current eles count
    const getShownEles = (id = null, name = null) => {
        let shownEles = [];
        for (const keyword of [id, name]) {
            if (keyword) {
                shownEles = form.querySelectorAll(`[${DYNAMIC_ELE_ATTR}="${id}"]`);
                if (shownEles.length) {
                    return shownEles;
                }
            }
        }
        return shownEles;
    };

    const findGenBtn = (btn) => {
        let genBtn = form.querySelectorAll(`#${btn}`);
        if (genBtn.length > 0) {
            return genBtn[0];
        }
        genBtn = form.querySelectorAll(`[name="${btn}"]`);
        if (genBtn.length > 0) {
            return genBtn[0];
        }
        return null;
    };

    const checkEleExistOnScreen = (btn, ele) => {
        if (btn === 'btn-add-end-proc-paracords-real') {
            btn = 'btn-add-end-proc';
        }
        const genBtn = findGenBtn(btn);
        if (!genBtn) {
            return null;
        }

        const dataGenBtnId = genBtn.id;
        const dataGenBtnName = genBtn.name;

        const shownEles = getShownEles(dataGenBtnId, dataGenBtnName);
        // const shownEleNumbers = [];
        for (const shownEle of shownEles) {
            if (ele.name === shownEle.name) {
                return null;
            }
            // shownEleNumbers.push(getLastNumberInString(shownEle.name));
        }
        // const eleNumber = getLastNumberInString(ele.name);
        // if (eleNumber && shownEleNumbers.length) {
        //     if (eleNumber < Math.max(...shownEleNumbers)) {
        //         return null;
        //     }
        // }

        return genBtn;
    };

    const genNewEle = (btn, ele) => {
        // 200 loop
        for (let i = 0; i < MAX_DYNAMIC_CARD; i++) {
            // console.log(`genNewEle: ${i}, ${ele.name}`);
            const btnAddNew = checkEleExistOnScreen(btn, ele);
            if (btnAddNew) {
                callAllEvent(btnAddNew, events = ['click']);
            } else {
                break;
            }
        }
    };

    const removeUnusedEle = (btn, usedEleNames) => {
        const genBtn = findGenBtn(btn);
        if (!genBtn) {
            return;
        }
        const dataGenBtnId = genBtn.id;
        const dataGenBtnName = genBtn.name;
        const shownEles = getShownEles(dataGenBtnId, dataGenBtnName);
        for (const shownEle of shownEles) {
            if (!usedEleNames.includes(shownEle.name)) {
                const target = form.querySelectorAll(`[name="${shownEle.name}"]`);
                $(target).closest('.card').find('.close-icon').trigger('click');
            }
        }
    };

    // count element need to generate:
    const genDynamicEle = (eles) => {
        const dicBtn = {};
        for (let i = 0; i < eles.length; i++) {
            const el = eles[i];
            if (el.genBtnId) {
                if (dicBtn[el.genBtnId]) {
                    dicBtn[el.genBtnId].push(i);
                } else {
                    dicBtn[el.genBtnId] = [i];
                }
            }
        }

        for (let btn in dicBtn) {
            btn = btn.replaceAll('"', '');
            const eleNames = [];
            for (const idx of dicBtn[btn]) {
                const ele = eles[idx];
                eleNames.push(ele.name);
                // check if process is exists then render HTML elements
                if (procConfigs[ele.value] && (!['TermSerialProcess', 'serialProcess'].includes(ele.name))) {
                    genNewEle(btn, ele);
                }

                if (ele.name === DATETIME_RANGE_PICKER_CLASS) {
                    ele.value = convertDatetimePickerSeparator(ele.value);
                    callAllEvent($(`#${btn}`), ['click']);
                    // APPLY VALUE TO RENDERED DATE TIME PICKER
                    const dates = $('.datetimerange-group').find(`[name=${DATETIME_RANGE_PICKER_CLASS}]`);
                    const renderedInput = dates[dates.length - 1];
                    $(renderedInput).val(ele.value).trigger('change');

                    setTimeout(() => {
                        removeUnusedDate();
                    }, 200);
                }
            }
            removeUnusedEle(btn, eleNames);
        }
        return eles;
    };

    const loadActiveTab = (data) => {
        for (const v of data) {
            const el = $(`#${v.id}`)[0];
            if (el && !checkActiveTab(el)) {
                isUserSwitchedTab = false;
                callAllEvent(`a[href="#${v.id}"]`, ['click']);
            }
        }
    };

    const isDateTimePickerEl = (name) => {
        if ([DATETIME_RANGE_PICKER_CLASS,
            DATE_RANGE_PICKER_CLASS,
            DATETIME_PICKER_CLASS,
            DATE_PICKER_CLASS].includes(name)) {
            return true;
        }
        return false;
    };

    // todo: check 09/16 endtime
    const loadNonRadioCheckEle = (data) => {
        const remainEles = [];
        const srcSetting = localStorage.getItem('srcSetting') || null;
        const desSetting = window.location.pathname;

        // load value
        for (const v of data) {
            if (!v.name) {
                continue;
            }

            let input = null;

            if (isDateTimePickerEl(v.name) && v.value.trim().length > 16) {
                v.value = convertDatetimePickerSeparator(v.value);
            }
            try {
                let eleSelector = buildEleSelector(v.name, null, v.id);
                input = form.querySelector(eleSelector);
                // selection
                if (v.name === 'remove_outlier_type' && v.value === 'majority') {
                    continue;
                }
                if (v.type === 'select-one') {
                    // in case of existing selection, but not existing item/option
                    // do nothing
                    if (input !== null && v.name === 'catExpBox' && !isLoadNew) {
                        v.value = facetGenerate(srcSetting, desSetting, v)
                    }
                }

                if (input === null || input === undefined) {
                    if (!isDateTimePickerEl(v.name)) {
                        eleSelector = buildEleSelector(v.name);
                        input = form.querySelector(eleSelector);
                        if (input === null || input === undefined) {
                            remainEles.push(v);
                            continue;
                        }
                    } else {
                        continue;
                    }
                }
            } catch (error) {
                remainEles.push(v);
                continue;
            }

            // special pattern
            if (v.name === 'recentTimeInterval' && !v.value) {
                v.value = '24';
            }
            if (v.name === 'compareType') {
                const devideDOM = $('select[id=divideOption]');
                if (devideDOM.length) {
                    const optionsDOM = $('select[id=divideOption]').find('option');
                    const options = Array.from(optionsDOM).map((opt) => $(opt).val());
                    if (!options.includes(v.value)) {
                        v.value = options[0];
                    }
                }
            }

            input.value = v.value;
            callAllEvent(input);
        }
        return remainEles;
    };

    const loadRadioCheckboxEle = (data) => {
        const remainEles = [];
        // load value
        for (const v of data) {
            if (!v.name) {
                continue;
            }
            let input = null;
            let eleSelector;
            if (v.name === CYCLIC_TERM.DIV_CALENDER) {
                eleSelector = buildEleSelector(null, null, v.id);
            } else {
                eleSelector = buildEleSelector(v.name);
            }
            try {
                input = form.querySelectorAll(eleSelector);
                if (input === null || input === undefined) {
                    remainEles.push(v);
                    continue;
                }
            } catch (error) {
                remainEles.push(v);
                continue;
            }

            for (const el of input) {
                if (el.value === v.value) {
                    if (v.type === 'radio') {
                        $(el).attr('checked', v.checked);
                        $(el).trigger('change');
                    }
                    if (v.name === 'judgeVar') {
                        $(el).trigger('change');
                    }
                    const oldCheck = el.checked;
                    el.checked = v.checked;
                    if (oldCheck !== el.checked) {
                        callAllEvent(el);
                    }
                }
            }
        }
        return remainEles;
    };

    const divideElementGroup = (data) => {
        const xIndexNames = ['serialProcess', 'serialColumn', 'serialOrder'];
        const activeTabs = [];
        const radioChecks = [];
        const others1 = [];
        const others2 = [];
        const indexVals = [];
        for (v of data) {
            if (v.type === 'radio' || v.type === 'checkbox') {
                radioChecks.push(v);
            } else if (v.isActiveTab) {
                activeTabs.push(v);
            } else if (Number(v.level) === 2) {
                others2.push(v);
            } else {
                others1.push(v);
            }
            if (xIndexNames.includes(v.name)) {
                indexVals.push(v);
            }
        }

        return [activeTabs, radioChecks, others1, others2, indexVals];
    };

    const loadIndex = (data) => {
        if (!$('#xAxisModal').length) return;
        const procs = [];
        const cols = [];
        const orders = [];
        if (!data.length) return;
        $('#serialTable tbody').html('');
        for (const ele of data) {
            if (ele.name === 'serialProcess') {
                procs.push(ele);
            } else if (ele.name === 'serialColumn') {
                cols.push(ele);
            } else {
                orders.push(ele);
            }
        }

        procs.forEach(async (proc, i) => {
            await addSerialOrderRow(null, 'serialProcess', 'serialColumn', 'serialOrder', Number(proc.value), Number(cols[i].value), orders[i].value);
            bindChangeProcessEvent();
            updatePriorityAndDisableSelected();
            setTimeout(() => { // wait select2 to be shown
                bindChangeOrderColEvent();
            }, 200);
        })
    };

    const innerFunc = (isLoad = true, isSaveToLocalStorage = true, savedData = null) => {
        if (isLoad) {
            let data;
            if (isSaveToLocalStorage) {
                data = JSON.parse(localStorage.getItem(key));
            } else {
                data = savedData;
            }

            if (!data) {
                return;
            }

            // gen dynamic eles
            genDynamicEle(data);

            const [activeTabs, radioChecks, others1, others2, indexVals] = divideElementGroup(data);

            if (isSaveToLocalStorage) {
                loadActiveTab(activeTabs);
            }
            const remainOthers1 = loadNonRadioCheckEle(others1);

            setTimeout(() => {
                loadNonRadioCheckEle(remainOthers1);
            }, 200);

            setTimeout(() => {
                const remainOthers2 = loadNonRadioCheckEle(others2);

                setTimeout(() => {
                    loadNonRadioCheckEle(remainOthers2);
                    loadIndex(indexVals);
                }, 200);

                setTimeout(() => {
                    const remainRadioChecks = loadRadioCheckboxEle(radioChecks);

                    setTimeout(() => {
                        loadRadioCheckboxEle(remainRadioChecks);
                    }, 200);

                    // load invalid
                    const allTabs = getAllTabs();
                    allTabs.each((i, tab) => {
                        // sort element
                        const searchGroups = getConditionGroups(tab);
                        for (const searchGroup of searchGroups) {
                            sortHtmlElements(searchGroup);
                        }

                        // sort element
                        const otherGroups = getNonConditionGroups(tab);
                        for (const otherGroup of otherGroups) {
                            sortHtmlElements(otherGroup);
                        }
                    });
                }, 500);
            }, 1000);
            setTimeout(() => {
                if (currentFormID && isLoadNew) {
                    const form = $(currentFormID);
                    currentFromDataFromLoadSetting = new FormData(form[0]);
                    resetChangeSettingMark();
                }
                isSettingLoading = false;
            }, 3500);
        } else if (isSaveToLocalStorage) {
            saveUserInput();
        } else {
            return serializeArray();
        }
    };

    return innerFunc;
};

const isLocalStorage = (localStorageKeyPrefix = '', formId = '') => {
    formId = formId.replace('#', '');
    const key = `${localStorageKeyPrefix}_${formId}_saveUserInput`;
    return localStorage.getItem(key) !== null;
};

const renameUserSavedData = (fromTab, toTab, items) => {
    const oldStr = dicTabs[fromTab];
    const newStr = dicTabs[toTab];
    for (const item of items) {
        item.id = item.id.replaceAll(oldStr, newStr);
        if (item.genBtnId) {
            item.genBtnId = item.genBtnId.replaceAll(oldStr, newStr);
        }
    }
};

const saveUserSetting = (hiddenTab, shownTab, targetId) => {
    const userInputForSave = saveLoadUserInput(`${targetId}`, '');
    const data = userInputForSave(false, false);

    // replace string
    renameUserSavedData(hiddenTab, shownTab, data);

    return data;
};

// get userName from localStorage
const getOrSetUserName = (createdBy = '') => {
    const lSKey = 'settingCommonUserName';
    if (createdBy) {
        localStorage.setItem(lSKey, createdBy);
        return createdBy;
    }
    return localStorage.getItem(lSKey);
};

// set userName to setting common modal
const updateUserNameForSettingModal = () => {
    const userName = getOrSetUserName();
    if (userName) {
        $('#userNameLabel').text(userName);
        const createdBy = $('#userSetting').find('input[name="created_by"]')[0];
        if (createdBy) {
            $(createdBy).val(userName);
        }
    }
};

// set id to None (create new)
const clearSettingID = () => {
    const settingId = $(`${settingModals.userSetting} input[name=id]`)[0];
    if (settingId) {
        $(settingId).val('');
    }
};


const updateSettingPriority = (elem, userSettingId) => {
    const settingPriority = $(elem).val();
    if (settingPriority) {
        $.get(`/ap/api/setting/user_setting/${userSettingId}`, {"_": $.now()}, (res) => {
            if (res.status === 200) {
                const settingDat = {
                    id: userSettingId,
                    priority: settingPriority,
                    created_by: res.data.created_by,
                    description: res.data.description,
                    key: res.data.key,
                    page: res.data.page,
                    settings: res.data.settings,
                    share_info: res.data.share_info,
                    title: res.data.title,
                    use_current_time: res.data.use_current_time,
                };
                createOrUpdateSetting(settingDat);
            }
        });
    }
};

const createHTMLRow = (setting, idx, isCurrentSetting) => {
    // TODO i18n: Shared, Private, btns
    const priorities = [5, 4, 3, 2, 1];
    let prioritySelection = '';
    let isDisabledSelectPriority = false;
    priorities.forEach((val) => {
        const selected = setting.priority == val ? ' selected="selected"' : '';
        let label = `${val}`;
        if (val === 5) {
            label = '5 (High)';
        } else if (val === 1) {
            label = '1 (Low)';
        }

        if (setting.priority === 0) {
            label = '0 (Demo)';
            isDisabledSelectPriority = true;
        }
        prioritySelection += `<option value="${val}"${selected}>${label}</option>`;
    });
    const objTitlePage = objTitle ? objTitle[setting.page] : '';
    const pageTitle = objTitlePage ? objTitlePage.title : '';
    if (!pageTitle) {
        return '';
    }

    const backgroundColor = isCurrentSetting ? ' style=" background-color: steelblue;"': '';
    const htmlRow =`<tr data-setting-id="${setting.id}" ${backgroundColor}>
        <td>${idx}</td>
        <td>${setting.share_info ? $(i18nEles.shared).text() : $(i18nEles.private).text()}</td>
        <td>
        	<select style="padding-left: 0; padding-right: 0; min-width: 84px" class="form-control" onchange="updateSettingPriority(this, ${setting.id})" ${isDisabledSelectPriority ? 'disabled' : ''}>
        		${prioritySelection}
			</select>
			<span class="hide">${setting.priority}</span>
		</td>
        <td class="col-4">${setting.title || ''}</td>
        <td class="text-center">${setting.created_by || ''}</td>
        <td class="col-date">${moment(setting.updated_at).format(DATE_FORMAT_WITHOUT_TZ) || ''}</td>
        <td class="action col-with-button">
        	<button name="showGraphNow" class="btn-success btn" data-setting-id="${setting.id}" data-setting-page="${setting.page}">${pageTitle}</button>
        	<span class="hide">${pageTitle}</span>
		</td>
        <td class="action col-with-button"><button class="btn-primary btn"
        	onclick="handleUseUserSetting(${setting.id})"><i class="fas fa-file-import"></i></button></td>
        <td class="action col-with-button"><button class="btn-orange btn"
        	onclick="editSettings(${setting.id})"><i class="far fa-edit"></i></button></td>
        <td class="action col-with-button">
            <button class="btn-secondary btn" onclick="handleCopyUrlToClipBoard(this, ${setting.id})">
                <i class="fa fa-copy"></i>
            </button>
        </td>
        <td class="action col-with-button">
        	<button class="btn-danger btn"
        	onclick="bindDeleteUserSetting(this, ${setting.id})"><i class="fas fa-trash"></i></button></td>
        <td class="col-3">${setting.description || ''}</td>
    </tr>`;
    return htmlRow;
};

const settingDataTableInit = () => {
    sortableTable('tblUserSetting', [0, 1, 2, 3, 4, 5, 6, 11], '100%');
};

const scrollToBottom = (id) => {
    const element = document.getElementById(id);
    if (!element) return;
    element.scrollTop = element.scrollHeight;
};

const showUserSettingsToModal = (userSettings) => {
    const userSettingsTblBody = $('#tblUserSetting tbody'); // TODO add to a eles const
    userSettingsTblBody.empty();

    const rowHTMLs = [];
    const currentUser = localStorage.getItem('settingCommonUserName');
    let idx = 1;
    for (const setting of userSettings) {
        const isShowSetting = !currentUser || currentUser && setting.created_by === currentUser || setting.share_info;

        if (isShowSetting) {
            const isCurrentSetting = currentLoadSetting ? setting.id == currentLoadSetting.id : false
            const rowHTML = createHTMLRow(setting, idx, isCurrentSetting);
            rowHTMLs.push(rowHTML);
            idx += 1;
        }
    }
    userSettingsTblBody.append(rowHTMLs);

    // right click for button
    $(settingModals.showGraphNow).on('contextmenu', (e) => {
        rightClickHandler(e, settingModals.menuExport);
        UserSettingExportInfo = e.currentTarget;
    });

    $(settingModals.showGraphNow).off('click');
    $(settingModals.showGraphNow).on('click', (e) => {
        const settingId = e.target.getAttribute('data-setting-id');
        const settingPage = e.target.getAttribute('data-setting-page');
        if (settingId && settingPage) {
            handleGoToSettingPage(e, settingId, settingPage);
        }
    });

    // right click for button
    $(settingModals.menuExport).on('mouseleave', (e) => {
        $(settingModals.menuExport).hide();
    });

    // right click for button
    $(settingModals.loadUserSettingLabel).on('contextmenu', (e) => {
        rightClickHandler(e, settingModals.menuImport);
    });

    // right click for button
    $(settingModals.menuImport).on('mouseleave', (e) => {
        $(settingModals.menuImport).hide();
    });
};

const bindDeleteUserSetting = (e, userSettingId) => {
    $('#delSettingConfirmed').attr('data-item-id', userSettingId);
    $('#deleteSettingConfirmModal').modal('show');
};

// eslint-disable-next-line no-unused-vars
const deleteUserSetting = (e) => {
    const userSettingId = $(e).attr('data-item-id');

    fetch(`/ap/api/setting/user_setting/${userSettingId}`, {
        method: 'DELETE',
        headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({}),
    })
        .then((response) => {
        })
        .then(() => {
        })
        .catch(() => {
        });

    $('#tblUserSetting').find(`tr[data-setting-id=${userSettingId}]`).remove();

    // reset state of bookmark
    if ($('#tblUserSetting>tbody').children().length === 0) {
        saveStateAndShowLabelSetting(null);
    }
};

const clearLoadingSetting = () => {
    localStorage.removeItem('loadingSetting');
};

const setExportMode = isExport => isExportMode = isExport;

const goToSettingPage = (userSettingId, settingPage, isImportMode = false, isBlank = false) => {
    localStorage.setItem('loadingSetting', JSON.stringify({
        redirect: true,
        settingID: userSettingId,
        isExportMode,
        isImportMode,
    }));

    // reset debug mode
    setExportMode(false);

    if (settingPage && !isBlank) {
        window.location.assign(settingPage);
    }

    if (settingPage && isBlank) {
        window.open(settingPage, '_blank');
    }
};

const handleGoToSettingPage = (e, userSettingId, settingPage) => {
    e.preventDefault();
    if (e.ctrlKey) {
        goToSettingPage(userSettingId, settingPage, false, true)
    } else {
        goToSettingPage(userSettingId, settingPage);
    }
};
const useUserSetting = (userSettingId = null, sharedSetting = null, onlyLoad = null, isLoadNew = true, fromPaste = false) => {
    const reqHeaders = new Headers();
    reqHeaders.append('Content-Type', 'application/json');
    isSettingLoading = true;

    fetch('/ap/api/setting/load_user_setting', {
        method: 'POST',
        headers: reqHeaders,
        body: JSON.stringify({
            setting_id: userSettingId,
            dic_original_setting: originalUserSettingInfo,
            active_form: getShowFormId(),
            shared_user_setting: sharedSetting,
        }),
    })
        .then(response => response.json())
        .then((json) => {
            const userSetting = json.data;
            if (!fromPaste) {
                currentLoadSetting = userSetting;
            }
            applyUserSetting(userSetting, onlyLoad, isLoadNew);
        })
        .catch(error => console.log('error', error));
};

const useUserSettingOnLoad = () => {
    const reqHeaders = new Headers();
    reqHeaders.append('Content-Type', 'application/json');

    const page = window.location.pathname;
    fetch(`/ap/api/setting/user_setting_page_top?page=${page}`, {
        method: 'GET',
        headers: reqHeaders,
    })
        .then(response => response.json())
        .then((json) => {
            const userSetting = json.data;
            currentLoadSetting = userSetting;
            applyUserSetting(userSetting);
        })
        .catch(error => console.log('error', error));
};

const showIndexInforBox = () => {
    const $xOptions = $('select[name=xOption]');
    if ($xOptions.val() === 'INDEX') {
        $('.index-inform-modal').addClass('show');
        // updateIndexInforTable();
    } else {
        $('.index-inform-modal').removeClass('show');
    }
};

const applyUserSetting = (userSetting, onlyLoad = null, isLoadNew = true) => {

    if (isEmpty(userSetting)) return;
    isSettingLoading = true;

    let userInputs;
    if (typeof (userSetting.settings) === 'string') {
        userInputs = JSON.parse(userSetting.settings || '{}');
    } else {
        userInputs = userSetting.settings || {};
    }

    // load user setting to gui
    let loadFunc;
    for (const formId in userInputs) {
        if (onlyLoad) {
            loadFunc = saveLoadUserInput(onlyLoad, '', '', null, isLoadNew);
        } else if (typeof (formId) === 'string') {
            loadFunc = saveLoadUserInput(`#${formId}`, '', '', null, isLoadNew);
        }

        const settingData = userInputs[formId];
        // console.log(settingData);
        if (loadFunc && settingData) {
            loadFunc(true, false, settingData);
            break;
        }
    }

    try {
        showIndexInforBox();
    } catch (e) {
        console.log(e);
    }

    // show current loading setting label
    saveStateAndShowLabelSetting(userSetting);
};

// save current user setting on global variable, beside that it will show title & "Overwrite save" button on UI
const saveStateAndShowLabelSetting = (userSetting, inplace = true) => {
    let userSettingText = '';

    // if not inplace replace, do nothing
    if (!inplace) {
        return;
    }
    // show "overwrite save" button in case load config
    // show bookmark when setting label is empty. Otherwise
    if (currentLoadSetting) {
        if (userSetting.title) {
            userSettingText = `${userSetting.title}`;
            // set current loading setting label
            fillStartBookmark();
            $('#setting-name').text(userSettingText)
            $(settingModals.bookmarkBtn).attr('title', userSettingText);
            $(settingModals.overwriteSaveSettingBtn).show();
            $(settingModals.editSettingBtn).show();
        }
    } else {
        $(settingModals.overwriteSaveSettingBtn).hide();
        $(settingModals.editSettingBtn).hide();
        $(settingModals.bookmarkBtn).show();
    }
};

const fillStartBookmark = () => {
    $(settingModals.bookmarkBtn).html('&#x2605');
};

const emptyStartBookmark = () => {
    $(settingModals.bookmarkBtn).html('&#x2606');
}

// eslint-disable-next-line no-unused-vars
const loadAllUserSetting = () => {

    $('#loadUserSettingModal').modal('show');

    const reqHeaders = new Headers();
    reqHeaders.append('Content-Type', 'application/json');

    fetch('/ap/api/setting/user_settings', {
        method: 'GET',
        headers: reqHeaders,
    })
        .then(response => response.json())
        .then((json) => {
            const userSettings = json.data;
            showUserSettingsToModal(userSettings);
        })
        .catch(error => console.log('error', error));
};

const showSettingModal = (userSetting) => {
    // get all keys in setting modal
    const settingModalKeys = [];

    resetSaveUserSettingModal();

    $.each($(settingModals.userSetting)[0].elements, (index, elem) => {
        settingModalKeys.push($(elem).attr('name'));
    });

    Object.keys(userSetting).forEach((settingKey) => {
        const setting = userSetting[settingKey];
        if (settingModalKeys.includes(settingKey)) {
            const settingInput = $(settingModals.userSetting)
                .find(`[name="${settingKey}"]`);
            const elType = settingInput.is('select') ? 'select' : settingInput.attr('type');
            switch (elType) {
                case 'checkbox':
                    settingInput.prop('checked', setting);
                    break;
                case 'select':
                    if (settingKey === 'priority' && setting === 0) {
                        settingInput.append(`<option value="0">0 (Demo)</option>`);
                        settingInput.val(0);
                        settingInput.prop('disabled', true);
                    } else {
                        settingInput.val(setting);
                    }
                    break;
                default:
                    settingInput.val(setting);
                    settingInput.attr('org-data', setting)
            }
        }
    });

    // assign setting
    previousSettingInfor = userSetting.settings || null;
    $(settingModals.loadSettingModal).modal('hide');
    $(settingModals.common).modal('show');
};

const getUserSettingById = async (userSettingId) => {
    const res = await fetchData(`/ap/api/setting/user_setting/${userSettingId}`, {}, 'GET');
    return res;
};

const getHostName = async () => {
    const res = await fetchData(`/ap/api/setting/host_name`, {}, 'GET');
    return res;
};

const editSettings = async (userSettingId) => {
    const res = await getUserSettingById(userSettingId);
    if (res.status === 200) {
        // change tile
        $(settingModals.userSettingLabel).text(i18nCommon.edit);
        $(settingModals.saveSettingConfirmBtn).attr('is-edit', 1);
        showSettingModal(res.data);
    }
    ;
};

const autoFillUserSetting = () => {
    const defaultTitle = generateDefaultNameExport();
    resetSaveUserSettingModal();
    $(settingModals.userSettingLabel).text(i18nCommon.saveSetting);
    $('input[name=title]').val(defaultTitle);
    $('select[name=priority]').val(1);
};

const resetSaveUserSettingModal = () => {
    $(settingModals.common).find('input[name=title]').val('');
    $(settingModals.common).find('input[name=id]').val('');
    $(settingModals.common).find('input[name=page]').val('');
    $(settingModals.common).find('input[name=created_by]').val('');
    $(settingModals.common).find('select[name=priority]').val('1');
    $(settingModals.common).find('select[name=priority] option[value="0"]').remove();
    $(settingModals.common).find('select[name=priority]').prop('disabled', false);
    $(settingModals.common).find('input[name=description]').val('');
    $(settingModals.common).find('input[name=use_current_time]').prop('checked', true);
    $(settingModals.common).find('input[name=share_info]').prop('checked', true);
}

const showOverwriteConfirmModel = () => {
    $(settingModals.overwriteConfirmation).modal('show');
};

const createOrUpdateSetting = (settingDat, inplace = true) => {
    $.ajax({
        url: '/ap/api/setting/user_setting',
        data: JSON.stringify(settingDat),
        dataType: 'json',
        type: 'POST',
        contentType: false,
        processData: false,
        success: (res) => {
            currentLoadSetting = res.data;
            $(settingModals.confirmation).modal('hide');
            $(settingModals.common).modal('hide');
            isSettingChanged = false;
            resetChangeSettingMark();
            saveStateAndShowLabelSetting(res.data, inplace);
        },
    });
};
const setModalOverlay = () => {
    $(document).on({
        'show.bs.modal': function () {
            const zIndex = 1040 + (10 * $('.modal:visible').length);
            $(this).css('z-index', zIndex);
            setTimeout(() => {
                $('.modal-backdrop').not('.modal-stack').css('z-index', zIndex - 1).addClass('modal-stack');
            }, 0);
        },
        'hidden.bs.modal': function () {
            if ($('.modal:visible').length > 0) {
                // restore the modal-open class to the body element, so that scrolling works
                // properly after de-stacking a modal.
                setTimeout(() => {
                    $(document.body).addClass('modal-open');
                }, 0);
            }
        },
    }, '.modal');
    // $(document).on('show.bs.modal', '.modal', function (event) {
    // 	var zIndex = 1040 + (10 * $('.modal:visible').length);
    // 	$(this).css('z-index', zIndex);
    // 	setTimeout(function() {
    // 		$('.modal-backdrop').not('.modal-stack').css('z-index', zIndex - 1).addClass('modal-stack');
    // 	}, 0);
    // });
};

const saveOriginalSetting = () => {
    const inputForms = $('form');
    const dicOutput = {};
    inputForms.each((i, form) => {
        const formId = form.getAttribute('id');
        const userInput = saveLoadUserInput(`#${formId}`);
        if (userInput) {
            dicOutput[formId] = userInput(false, false);
        }
    });

    return dicOutput;
};

const getSettingCommonInfo = () => {
    // retrieve data from setting forms
    const formSettingDat = {};
    mainFormSettings.each((i, form) => {
        const getFormSettings = saveLoadUserInput(`#${form.id}`);
        const settingDat = getFormSettings(false, false);
        formSettingDat[form.id] = settingDat;
    });

    // retrieve common information for setting
    const settingCommonArray = $(settingModals.userSetting).serializeArray();
    const settingCommonInfo = {};
    $.each(settingCommonArray, (i, input) => {
        settingCommonInfo[input.name] = input.value;
    });

    // remove id attribute if empty
    if (!settingCommonInfo.id) {
        delete settingCommonInfo.id;
    }

    if (!settingCommonInfo.page) {
        settingCommonInfo.page = window.location.pathname;
    }

    if (window.location.pathname === settingCommonInfo.page) {
        // assign settings and send to DB
        // add Graph setting data

        const graphSettingsArea = $('#graph-settings-area');

        const graphSettings = [];

        const radioEls = graphSettingsArea.find('input[type=radio]:is(:checked)');

        radioEls.each((i, el) => {
            graphSettings.push({
                name: $(el).attr('name'),
                id: $(el).attr('id'),
                defaultVal: $(el).attr(CONST.DEFAULT_VALUE),
                value: $(el).val(),
                type: 'radio',
                order: 0,
            });
        });

        const selects = graphSettingsArea.find('select');
        selects.each((i, el) => {
            graphSettings.push({
                name: $(el).attr('name'),
                id: $(el).attr('id'),
                defaultVal: $(el).attr(CONST.DEFAULT_VALUE),
                value: $(el).val(),
                type: 'select',
                order: 2,
            });
        });

        const checkboxs = graphSettingsArea.find('input[type=checkbox]');
        checkboxs.each((i, el) => {
            const trueVal = ['true', 'True', '1', 1];
            const falseVal = ['false', 'False', '0', 0];
            let defaultValue = $(el).attr(CONST.DEFAULT_VALUE);
            if (defaultValue && falseVal.includes(defaultValue)) {
                defaultValue = false;
            }
            if (defaultValue && trueVal.includes(defaultValue)) {
                defaultValue = true;
            }
            graphSettings.push({
                name: $(el).attr('name'),
                id: $(el).attr('id'),
                defaultVal: !!defaultValue,
                value: $(el).val(),
                checked: $(el).prop('checked'),
                type: 'checkbox',
                order: 1,
            });
        });

        const texts = graphSettingsArea.find('input:not([type=checkbox]):not([type=radio])');
        texts.each((i, el) => {
            graphSettings.push({
                name: $(el).attr('name'),
                id: $(el).attr('id'),
                defaultVal: $(el).attr(CONST.DEFAULT_VALUE),
                value: $(el).val(),
                type: 'text',
                order: 1,
            });
        });


        const filterData = {
            dic_cat_filters: lastUsedFormData ? JSON.parse(lastUsedFormData.get('dic_cat_filters')) : '',
            temp_cat_exp: lastUsedFormData ? JSON.parse(lastUsedFormData.get('temp_cat_exp')) : '',
            temp_cat_procs: lastUsedFormData ? JSON.parse(lastUsedFormData.get('temp_cat_procs')) : '',
        };

        const isIndexOder = hasIndexOrderInGraphSetting(graphSettings);

        if (isIndexOder) {
            formSettingDat['indexOrder'] = latestIndexOrder;
        }

        formSettingDat['graphSetting'] = graphSettings;
        formSettingDat['filter'] = filterData;

        settingCommonInfo.settings = JSON.stringify(formSettingDat);
    } else {
        settingCommonInfo.settings = previousSettingInfor;
    }

    return settingCommonInfo;
};


const hasIndexOrderInGraphSetting = (graphSettings = []) => {
    const isIndexOrder = graphSettings.filter(graph => graph.name === 'XAxisOrder' && graph.value === CONST.XOPT_INDEX).length > 0;
    return isIndexOrder;
}

const convertDatetimePickerSeparator = (value) => {
    const temp = value;
    return temp.substr(0, 16) + DATETIME_PICKER_SEPARATOR + temp.substr(19);
};

const checkExistTitleSetting = async (title) => {
    loadingShow(true);
    $.ajax({
        url: '/ap/api/setting/check_exist_title_setting',
        data: JSON.stringify({title}),
        dataType: 'json',
        type: 'POST',
        contentType: false,
        processData: false,
        success: (data) => {
            if (data.is_exist) {
                displayRegisterMessage(settingModals.alertUserSettingErrorMsg, {
                    message: $('#i18nErrorSameTitleSetting').text(),
                    is_error: true,
                });
                return false;
            }
            $(settingModals.confirmation).modal('show');
        },
        error: (_res) => {
            loadingHide();
        },
    }).then(() => {
        loadingHide();
    });
};

$(document).ready(() => {
    // save user input
    const inputForms = $('form');
    const saveUserBtn = $('#saveUserBtn');
    const loadUserBtn = $('#loadUserBtn');
    if (inputForms.length > 0) {
        $(saveUserBtn).show();
        $(loadUserBtn).show();
    } else {
        $(saveUserBtn).hide();
        $(loadUserBtn).hide();
    }
    $(saveUserBtn).click(() => {
        inputForms.each((i, form) => {
            const userInput = saveLoadUserInput(`#${form.id}`, window.location.pathname);
            userInput(false);
        });
    });

    $(loadUserBtn).click(() => {
        inputForms.each((i, form) => {
            const userInput = saveLoadUserInput(`#${form.id}`, window.location.pathname);
            userInput();
        });
    });

    settingDataTableInit();


    // save user setting to DB
    mainFormSettings = $(settingModals.mainSettingForm);

    // trigger to validate data input before saving user setting
    $(settingModals.saveSettingConfirmBtn).on('click', async () => {
        // clear error message
        $(settingModals.alertUserSettingErrorMsg).css('display', 'none');
        const titleEl = $('input[name=title]');
        const orgTitle = titleEl.attr('org-data');
        const isChangeTitle = orgTitle !== titleEl.val();
        if (isChangeTitle) {
            await checkExistTitleSetting(titleEl.val());
        } else {
            $(settingModals.confirmation).modal('show');
        }

        // const isEdit = $(settingModals.saveSettingConfirmBtn).attr('is-edit');
        // if (!isEdit) {
        //     $(settingModals.saveUserSettingConfirmContent).text(i18nCommon.saveUserSettingConfirm);
        // }
        return false;
    });

    // trigger to save user setting
    $(settingModals.confirmBtn).on('click', () => {
        let invalidPage = false;
        Object.keys(saveSettingExceptionPages).forEach((k) => {
            if (window.location.pathname.includes(saveSettingExceptionPages[k])) {
                invalidPage = true;
            }
        });

        // return if invalidPage
        if (invalidPage) {
            return false;
        }

        // retrieve data from setting forms
        const settingCommonInfo = getSettingCommonInfo();

        // set userName in localStorage at first time
        getOrSetUserName(settingCommonInfo.created_by);

        const inplaceSetting = !settingCommonInfo.id ? true : (currentLoadSetting && settingCommonInfo)
            ? (Number(currentLoadSetting.id) === Number(settingCommonInfo.id))
            : true;
        createOrUpdateSetting(settingCommonInfo, inplaceSetting);
    });

    // trigger to overwrite save user setting
    $(settingModals.overwriteConfirmBtn).on('click', () => {
        // retrieve data from setting forms
        const settingCommonInfo = currentLoadSetting;
        const settingInfo = getSettingCommonInfo();
        const saveGraphSetting = $('[name=save_graph_settings_overwrite]').prop('checked');
        settingCommonInfo.save_graph_settings = saveGraphSetting || '';
        settingCommonInfo.settings = settingInfo.settings;

        // set userName in localStorage at first time
        getOrSetUserName(settingCommonInfo.created_by);
        createOrUpdateSetting(settingCommonInfo);
    });

    // set userName for setting common modal
    $(settingModals.saveSettingBtn).on('click', () => {
        // clear error message
        $(settingModals.alertUserSettingErrorMsg).css('display', 'none');
        clearSettingID();
        updateUserNameForSettingModal();
    });

    setModalOverlay();

    const dragAreaCls = '.import-drag-area';
    const selectFileBtnId = '#importSelectFileBtn';
    const selectFileInputId = '#importSelectFileInput';
    genTriggerFileSetting(dragAreaCls, selectFileBtnId, selectFileInputId);

    // init
    setTimeout(() => {
        if (currentFormID) {
            const form = $(currentFormID);
            currentFromDataFromLoadSetting = new FormData(form[0]);
            form.find('input').on('change', () => {
                compareSettingChange();
            });

            form.find('select').on('change', () => {
                compareSettingChange();
            });
        }
        isSettingLoading = false;
    }, 3500);

    $('.go-to-page').on('contextmenu', (e) => {
        const takeOverItems = $('#contextMenuSidebar').find('.takeover-item');
        takeOverItems.hide();
        const parentItem = $(e.currentTarget).closest('.menu-group-item');
        const isVisualPage = parentItem.hasClass('visual-page') || false;
        if (isVisualPage) {
            takeOverItems.show();
        }

        selectedHref = e.target.closest('a').getAttribute('href');
        rightClickHandler(e, settingModals.sideBarContextMenu);
    });

    $('.go-to-page').on('click', (e) => {
        e.preventDefault();
        const href = e.target.closest('a').getAttribute('href');
        if (e.ctrlKey) {
            goToOtherPage(href, false);
        } else {
            goToOtherPage(href);
        }
    });
});

const showGraphWithDebugInfo = () => {
    // reset debug mode
    setExportMode(true);
    if (UserSettingExportInfo !== null) {
        $(UserSettingExportInfo).trigger('click');
    }
};

const openImportDialog = () => {
    $('#importForDebug').modal('show');
};

const editUserSetting = () => {
    if (currentLoadSetting && currentLoadSetting.id) {
        editSettings(currentLoadSetting.id);
    }
    return true;
};
const compareSettingChange = () => {
    if (currentFormID) {
        const newFormData = new FormData($(currentFormID)[0]);
        if (currentFromDataFromLoadSetting && newFormData) {
            // remove exclude name from form
            ['export_from'].map(val => {
                currentFromDataFromLoadSetting.delete(val);
                newFormData.delete(val);
            });
            isSettingChanged = JSON.stringify([...currentFromDataFromLoadSetting.entries()]) !== JSON.stringify([...newFormData.entries()]);
        }
    }

    if (isSettingChanged) {

        if (currentLoadSetting) {
            emptyStartBookmark();
        }

        $('#setting-change-mark').show();
        $(window).off("beforeunload");
        $(window).on("beforeunload", function () {
            return 'Do you want to save changes?';
        });
    } else {
        fillStartBookmark();
        resetChangeSettingMark();
    }
}

const resetChangeSettingMark = () => {
    isSettingChanged = false;
    $('#setting-change-mark').hide();
    $(window).off("beforeunload");
    if (currentLoadSetting) {
        fillStartBookmark();
    }
};

const showSettingChangeModalHandler = (callback) => {
    if (isSettingChanged) {
        $(settingModals.changeSettingConfirmModal).modal('show')

        $('#saveChangeSetting').on('click', () => {
            $(settingModals.changeSettingConfirmModal).modal('hide');
            $('#saveUserSetting').trigger('click');
        });

        $('#discardSaveChangeSetting').on('click', () => {
            $(settingModals.changeSettingConfirmModal).modal('hide');
            // load unchanged setting
            if (currentLoadSetting) {
                currentFromDataFromLoadSetting = null;
                useUserSetting(currentLoadSetting.id);
            }
            resetChangeSettingMark();
            callback();
        });
    } else {
        callback();
    }
};

const goToOtherPage = (href, inplace = true, emptyPage = false, mainPage = '') => {
    if (!href) {
        href = selectedHref;
    }
    if (mainPage) {
        href = `/ap/tile_interface/${mainPage}`;
    }
    if (emptyPage) {
        useTileInterface().set();
    }
    if (inplace) {
        showSettingChangeModalHandler(() => {
            resetChangeSettingMark();
            window.location.assign(href);
        });
    } else {
        window.open(href, '_blank');
    }
};

const handleUseUserSetting = (id) => {
    useUserSetting(id);
    // hide modal when click load button
    $(settingModals.loadSettingModal).modal('hide');
};

const isSaveGraphSetting = () => {
    return currentLoadSetting && currentLoadSetting.save_graph_settings && !isSettingChanged;
};

const handleCopyUrlToClipBoard = async (e, userSettingId) => {
    const res = await getUserSettingById(userSettingId);
    let page = '';
    if (res.status === 200) {
        page = res.data.page;
        let url = `${window.location.host}${page}?user_setting_id=${res.data.id}`;
        const serverMachineName = "";
        url = url.replace(/localhost|127.0.0.1/, res.hostname)
        $('#copyClipboardContent').show();
        $('#copyClipboardContentText').text(url);
        setTimeout(() => {
            $('#copyUrlButton').click();
            setTooltip($(e), 'Copied!');
        }, 300);
    }
}


const getFilterOnDemand = () => {
    if (!currentLoadSetting) return null;
    const settings = JSON.parse(currentLoadSetting.settings);
    return settings.filter;
};

const getGraphSettings = () => {
    if (!currentLoadSetting) return null;
    const settings = JSON.parse(currentLoadSetting.settings);
    // sort by order

    return settings.graphSetting ? settings.graphSetting.sort(function (a, b) {
        return a.order > b.order ? -1 : 1;
    }) : null;
};

const getIndexOrder = () => {
    if (!currentLoadSetting) return null;
    const settings = JSON.parse(currentLoadSetting.settings);

    return settings.indexOrder || [];
}

const setFitlerIntoFormData = (formData) => {
    if (!isSaveGraphSetting()) return formData;
    const filter = getFilterOnDemand();
    if (!filter) return formData;

    for (const key in filter) {
        if (filter[key]) {
            formData.set(key, JSON.stringify(filter[key]));
        }
    }
    return formData;
};

const loadGraphSetings = (isFirstTime = false) => {
    if (!isFirstTime) return;
    if (!isSaveGraphSetting()) return;
    const graphSettings = getGraphSettings();

    if (!graphSettings) return;

    for (const setting of graphSettings) {
        const graphArea = $('#graph-settings-area');
        let el = null;
        let selectorStr = '';
        if (setting === 'XAxisOrder') continue;
        if (setting.name) {
            selectorStr = `[name=${setting.name}]`;
            // el = graphArea.find(`[name=${setting.name}]`);
        } else {
            // el = graphArea.find(`#${setting.id}`);
            selectorStr = `#${setting.id}`;
        }

        let isTriggerChange = setting.defaultVal !== setting.value;

        if (setting.type === 'radio') {
            el = graphArea.find(`${selectorStr}[value=${setting.value}]`).prop('checked', true);
        } else if (setting.type === 'select') {
            el = graphArea.find(`${selectorStr}`).val(setting.value);
        } else if (setting.type === 'checkbox') {
            el = graphArea.find(`${selectorStr}`).prop('checked', setting.checked);
            isTriggerChange = setting.defaultVal !== setting.checked;
        } else if (setting.type === 'text') {
            el = graphArea.find(`${selectorStr}`).val(setting.value);
        }

        if (isTriggerChange) {
            el.trigger('change');
        }
    }
    ;
};

const getDicChecked = () => {
    if (!isSaveGraphSetting()) return null;

    return getFilterOnDemand().dic_cat_filters;
};

const facetGenerate = (src, des, value) => {
    let facetVal = value.value;
    const facets = {
        LV1: '1',
        LV2: '2',
        DIV: '3',
    };

    if (src && des) {

        if (src.includes('stp') && des.includes('rlp') && facetVal !== '') {
            // from stp -> rlp
            // facet lv1 -> div
            // facet lv2 -> lv1
            facetVal = (facetVal === facets.LV1) ? facets.DIV : facets.LV1;
        }
        if (src.includes('rlp') && des.includes('stp') && facetVal !== '') {
            // from rlp -> stp
            // facet div -> lv1
            // facet lv1 -> lv2
            facetVal = (facetVal === facets.DIV) ? facets.LV1 : facets.LV2;
        }
    }
    return facetVal;
};