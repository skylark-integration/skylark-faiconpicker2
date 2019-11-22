define([
    "skylark-langx/skylark",
    "skylark-langx/langx",
    "skylark-domx-query",
    "skylark-widgets-base/Widget",
    "./allIcons"
],function(skylark,langx, $, Widget,allIcons) {
    'use strict';

    var _helpers = {

        isElement: function(selector) {
            return ($(selector).length > 0);
        },

    };

    var IconPicker = Widget.inherit({
        klassName : "IconPicker",

        pluginName : "lark.iconpicker",

        options : {
            title: false, // Popover title (optional) only if specified in the template
            selected: false, // use this value as the current item and ignore the original
            defaultValue: false, // use this value as the current item if input or element value is empty
            placement: 'bottom', // (has some issues with auto and CSS). auto, top, bottom, left, right
            collision: 'none', // If true, the popover will be repositioned to another position when collapses with the window borders
            animation: true, // fade in/out on show/hide ?
            //hide iconpicker automatically when a value is picked. it is ignored if mustAccept is not false and the accept button is visible
            hideOnSelect: false,
            showFooter: false,
            searchInFooter: false, // If true, the search will be added to the footer instead of the title
            mustAccept: false, // only applicable when there's an iconpicker-btn-accept button in the popover footer
            selectedCustomClass: 'bg-primary', // Appends this class when to the selected item
            icons: allIcons, // list of icon classes 
            fullClassFormatter: function(val) {
                return val;
            },
            input: 'input,.iconpicker-input', // children input selector
            inputSearch: false, // use the input as a search box too?
            container: false, //  Appends the popover to a specific element. If not set, the selected element or element parent is used
            component: '.input-group-addon,.iconpicker-component', // children component jQuery selector or object, relative to the container element
            // Plugin templates:
            templates: {
                popover: '<div class="iconpicker-popover popover"><div class="arrow"></div>' +
                    '<div class="popover-title"></div><div class="popover-content"></div></div>',
                footer: '<div class="popover-footer"></div>',
                buttons: '<button class="iconpicker-btn iconpicker-btn-cancel btn btn-default btn-sm">Cancel</button>' +
                    ' <button class="iconpicker-btn iconpicker-btn-accept btn btn-primary btn-sm">Accept</button>',
                search: '<input type="search" class="form-control iconpicker-search" placeholder="Type to filter" />',
                iconpicker: '<div class="iconpicker"><div class="iconpicker-items"></div></div>',
                iconpickerItem: '<a role="button" href="javascript:;" class="iconpicker-item"><i></i></a>',
            }
        },

        //_construct : function(element, options) {
        _init : function() {
            this.$element = $(this._elm).addClass('iconpicker-element');

            //this.options = langx.extend(true,{}, this.options, this.element.data(), options);
            this.options.originalPlacement = this.options.placement;

            // Iconpicker container element
            this.container = (_helpers.isElement(this.options.container) ? $(this.options.container) : false);
            if (this.container === false) {
                if (this.$element.is('.dropdown-toggle')) {
                    this.container = $('~ .dropdown-menu:first', this.$element);
                } else {
                    this.container = (this.$element.is('input,textarea,button,.btn') ? this.$element.parent() : this.$element);
                }
            }
            this.container.addClass('iconpicker-container');

            if (this.isDropdownMenu()) {
                this.options.placement = 'inline';
            }

            // Is the element an input? Should we search inside for any input?
            this.input = (this.$element.is('input,textarea') ? this.$element.addClass('iconpicker-input') : false);
            if (this.input === false) {
                this.input = (this.container.find(this.options.input));
                if (!this.input.is('input,textarea')) {
                    this.input = false;
                }
            }

            // Plugin as component ?
            this.component = this.isDropdownMenu() ? this.container.parent().find(this.options.component) : this.container.find(this.options.component);
            if (this.component.length === 0) {
                this.component = false;
            } else {
                this.component.find('i').addClass('iconpicker-component');
            }

            // Create popover and iconpicker HTML
            this._createPopover();
            this._createIconpicker();

            if (this.getAcceptButton().length === 0) {
                // disable this because we don't have accept buttons
                this.options.mustAccept = false;
            }

            // Avoid CSS issues with input-group-addon(s)
            if (this.isInputGroup()) {
                this.container.parent().append(this.popover);
            } else {
                this.container.append(this.popover);
            }

            this._id = this.getUID();
            
            // Bind events
            this._bindElementEvents();
            this._bindWindowEvents();

            // Refresh everything
            this.update(this.options.selected);

            if (this.isInline()) {
                this.show();
            }
        },


        _createPopover: function() {
            this.popover = $(this.options.templates.popover);

            // title (header)
            var _title = this.popover.find('.popover-title');
            if (!!this.options.title) {
                _title.append($('<div class="popover-title-text">' + this.options.title + '</div>'));
            }
            if (this.hasSeparatedSearchInput() && !this.options.searchInFooter) {
                _title.append(this.options.templates.search);
            } else if (!this.options.title) {
                _title.remove();
            }

            // footer
            if (this.options.showFooter && this.options.templates.footer) {
                var _footer = $(this.options.templates.footer);
                if (this.hasSeparatedSearchInput() && this.options.searchInFooter) {
                    _footer.append($(this.options.templates.search));
                }
                if (this.options.templates.buttons) {
                    _footer.append($(this.options.templates.buttons));
                }
                this.popover.append(_footer);
            }

            if (this.options.animation === true) {
                this.popover.addClass('fade');
            }

            return this.popover;
        },
        _createIconpicker: function() {
            var _self = this;
            this.iconpicker = $(this.options.templates.iconpicker);

            var itemClickFn = function(e) {
                var $this = $(this);
                if ($this.is('i')) {
                    $this = $this.parent();
                }

                if (_self.options.mustAccept === false) {
                    _self.update($this.data('iconpickerValue'));
                    _self.emit('picked', {
                        data: _self.iconpickerValue
                    });

                } else {
                    _self.update($this.data('iconpickerValue'), true);
                }

                if (_self.options.hideOnSelect && (_self.options.mustAccept === false)) {
                    // only hide when the accept button is not present
                    _self.hide();
                }
            };

            var $itemElementTemplate = $(this.options.templates.iconpickerItem);
            var $elementsToAppend = [];
            for (var i in this.options.icons) {
                if (typeof this.options.icons[i].title === 'string') {
                    var itemElement = $itemElementTemplate.clone();
                    itemElement.find('i')
                        .addClass(this.options.fullClassFormatter(this.options.icons[i].title));
                    itemElement.data('iconpickerValue', this.options.icons[i].title)
                        .on('click.iconpicker', itemClickFn);

                    itemElement.attr('title', '.' + this.options.icons[i].title);
                    if (this.options.icons[i].searchTerms.length > 0) {
                        var searchTerms = '';
                        for (var j = 0; j < this.options.icons[i].searchTerms.length; j++) {
                            searchTerms = searchTerms + this.options.icons[i].searchTerms[j] + ' ';
                        }
                        itemElement.attr('data-search-terms', searchTerms);
                    }
                    $elementsToAppend.push(itemElement);
                }
            }
            this.iconpicker.find('.iconpicker-items').append($elementsToAppend);
            this.popover.find('.popover-content').append(this.iconpicker);

            return this.iconpicker;
        },
        _isEventInsideIconpicker: function(e) {
            var _t = $(e.target);
            if ((!_t.hasClass('iconpicker-element') ||
                    (_t.hasClass('iconpicker-element') && !_t.is(this.$element))) &&
                (_t.parents('.iconpicker-popover').length === 0)) {
                return false;
            }
            return true;
        },
        _bindElementEvents: function() {
            var _self = this;

            this.getSearchInput().on('keyup.iconpicker', function() {
                _self.filter($(this).val().toLowerCase());
            });

            this.getAcceptButton().on('click.iconpicker', function() {
                var _picked = _self.iconpicker.find('.iconpicker-selected').get(0);

                _self.update(_self.iconpickerValue);

                _self.emit('picked', {
                    data: _self.iconpickerValue
                });

                if (!_self.isInline()) {
                    _self.hide();
                }
            });
            this.getCancelButton().on('click.iconpicker', function() {
                if (!_self.isInline()) {
                    _self.hide();
                }
            });

            this.$element.on('focus.iconpicker', function(e) {
                _self.show();
                e.stopPropagation();
            });

            if (this.hasComponent()) {
                this.component.on('click.iconpicker', function() {
                    _self.toggle();
                });
            }

            if (this.hasInput()) {
                // Bind input keyup event
                this.input.on('keyup.iconpicker', function(e) {
                    if (!_helpers.inArray(e.keyCode, [38, 40, 37, 39, 16, 17, 18, 9, 8, 91, 93, 20, 46, 186, 190, 46, 78, 188, 44, 86])) {
                        _self.update();
                    } else {
                        _self._updateFormGroupStatus(_self.getValid(this.value) !== false);
                    }
                    if (_self.options.inputSearch === true) {
                        _self.filter($(this).val().toLowerCase());
                    }
                    //_self.hide();
                });
            }

        },
        _bindWindowEvents: function() {
            var $doc = $(window.document);
            var _self = this;

            // Add a namespace to the document events so they can be identified
            // later for every instance separately
            var _eventNs = '.iconpicker.inst' + this._id;

            $(window).on('resize.iconpicker' + _eventNs + ' orientationchange.iconpicker' + _eventNs, function(e) {
                // reposition popover
                if (_self.popover.hasClass('in')) {
                    _self.updatePlacement();
                }
            });

            if (!_self.isInline()) {
                $doc.on('mouseup' + _eventNs, function(e) {
                    if (!_self._isEventInsideIconpicker(e) && !_self.isInline()) {
                        _self.hide();
                    }
                });
            }
        },

        
        _unbindElementEvents: function() {
            this.popover.off('.iconpicker');
            this.$element.off('.iconpicker');

            if (this.hasInput()) {
                this.input.off('.iconpicker');
            }

            if (this.hasComponent()) {
                this.component.off('.iconpicker');
            }

            if (this.hasContainer()) {
                this.container.off('.iconpicker');
            }
        },
        _unbindWindowEvents: function() {
            // destroy window and window.document bound events
            $(window).off('.iconpicker.inst' + this._id);
            $(window.document).off('.iconpicker.inst' + this._id);
        },

        updatePlacement: function(placement, collision) {
            placement = placement || this.options.placement;
            this.options.placement = placement; // set new placement
            collision = collision || this.options.collision;
            collision = (collision === true ? 'flip' : collision);

            var _pos = {
                // at: Defines which position (or side) on container element to align the
                // popover element against: "horizontal vertical" alignment.
                at: "right bottom",
                // my: Defines which position (or side) on the popover being positioned to align
                // with the container element: "horizontal vertical" alignment
                my: "right top",
                // of: Which element to position against.
                of: (this.hasInput() && !this.isInputGroup()) ? this.input : this.container,
                // collision: When the positioned element overflows the window (or within element)
                // in some direction, move it to an alternative position.
                collision: (collision === true ? 'flip' : collision),
                // within: Element to position within, affecting collision detection.
                within: window
            };

            // remove previous classes
            this.popover.removeClass('inline topLeftCorner topLeft top topRight topRightCorner ' +
                'rightTop right rightBottom bottomRight bottomRightCorner ' +
                'bottom bottomLeft bottomLeftCorner leftBottom left leftTop');

            if (typeof placement === 'object') {
                // custom position ?
                return this.popover.position(langx.extend({}, _pos, placement));
            }

            switch (placement) {
                case 'inline':
                    {
                        _pos = false;
                    }
                    break;
                case 'topLeftCorner':
                    {
                        _pos.my = 'right bottom';
                        _pos.at = 'left top';
                    }
                    break;

                case 'topLeft':
                    {
                        _pos.my = 'left bottom';
                        _pos.at = 'left top';
                    }
                    break;

                case 'top':
                    {
                        _pos.my = 'center bottom';
                        _pos.at = 'center top';
                    }
                    break;

                case 'topRight':
                    {
                        _pos.my = 'right bottom';
                        _pos.at = 'right top';
                    }
                    break;

                case 'topRightCorner':
                    {
                        _pos.my = 'left bottom';
                        _pos.at = 'right top';
                    }
                    break;

                case 'rightTop':
                    {
                        _pos.my = 'left bottom';
                        _pos.at = 'right center';
                    }
                    break;

                case 'right':
                    {
                        _pos.my = 'left center';
                        _pos.at = 'right center';
                    }
                    break;

                case 'rightBottom':
                    {
                        _pos.my = 'left top';
                        _pos.at = 'right center';
                    }
                    break;

                case 'bottomRightCorner':
                    {
                        _pos.my = 'left top';
                        _pos.at = 'right bottom';
                    }
                    break;

                case 'bottomRight':
                    {
                        _pos.my = 'right top';
                        _pos.at = 'right bottom';
                    }
                    break;
                case 'bottom':
                    {
                        _pos.my = 'center top';
                        _pos.at = 'center bottom';
                    }
                    break;

                case 'bottomLeft':
                    {
                        _pos.my = 'left top';
                        _pos.at = 'left bottom';
                    }
                    break;

                case 'bottomLeftCorner':
                    {
                        _pos.my = 'right top';
                        _pos.at = 'left bottom';
                    }
                    break;

                case 'leftBottom':
                    {
                        _pos.my = 'right top';
                        _pos.at = 'left center';
                    }
                    break;

                case 'left':
                    {
                        _pos.my = 'right center';
                        _pos.at = 'left center';
                    }
                    break;

                case 'leftTop':
                    {
                        _pos.my = 'right bottom';
                        _pos.at = 'left center';
                    }
                    break;

                default:
                    {
                        return false;
                    }
                    break;

            }

            this.popover.css({
                'display': (this.options.placement === 'inline') ? '' : 'block'
            });

            if (_pos !== false) {
                this.popover.position(_pos).css('maxWidth', $(window).width() - this.container.offset().left - 5);
            } else {
                //reset position
                this.popover.css({
                    'top': 'auto',
                    'right': 'auto',
                    'bottom': 'auto',
                    'left': 'auto',
                    'maxWidth': 'none'
                });
            }
            this.popover.addClass(this.options.placement);

            return true;
        },
        _updateComponents: function() {
            // Update selected item
            this.iconpicker.find('.iconpicker-item.iconpicker-selected')
                .removeClass('iconpicker-selected ' + this.options.selectedCustomClass);

            if (this.iconpickerValue) {
                this.iconpicker.find('.' + this.options.fullClassFormatter(this.iconpickerValue).replace(/ /g, '.')).parent()
                    .addClass('iconpicker-selected ' + this.options.selectedCustomClass);
            }

            // Update component item
            if (this.hasComponent()) {
                var icn = this.component.find('i');
                if (icn.length > 0) {
                    icn.attr('class', this.options.fullClassFormatter(this.iconpickerValue));
                } else {
                    this.component.html(this.getHtml());
                }
            }

        },
        _updateFormGroupStatus: function(isValid) {
            if (this.hasInput()) {
                if (isValid !== false) {
                    // Remove form-group error class if any
                    this.input.parents('.form-group:first').removeClass('has-error');
                } else {
                    this.input.parents('.form-group:first').addClass('has-error');
                }
                return true;
            }
            return false;
        },
        getValid: function(val) {
            // here we must validate the value (you may change this validation
            // to suit your needs
            if (!langx.isString(val)) {
                val = '';
            }

            var isEmpty = (val === '');

            // trim string
            val = langx.trim(val);
            var e = false;
            for (var i = 0; i < this.options.icons.length; i++) {
                if (this.options.icons[i].title === val) {
                    e = true;
                    break;
                };
            }

            if (e || isEmpty) {
                return val;
            }
            return false;
        },
        /**
         * Sets the internal item value and updates everything, excepting the input or element.
         * For doing so, call setSourceValue() or update() instead
         */
        setValue: function(val) {
            // sanitize first
            var _val = this.getValid(val);
            if (_val !== false) {
                this.iconpickerValue = _val;

                return this.iconpickerValue;
            } else {

                return false;
            }
        },
        getHtml: function() {
            return '<i class="' + this.options.fullClassFormatter(this.iconpickerValue) + '"></i>';
        },
        /**
         * Calls setValue and if it's a valid item value, sets the input or element value
         */
        setSourceValue: function(val) {
            val = this.setValue(val);
            if ((val !== false) && (val !== '')) {
                if (this.hasInput()) {
                    this.input.val(this.iconpickerValue);
                } else {
                    this.$element.data('iconpickerValue', this.iconpickerValue);
                }

            }
            return val;
        },
        /**
         * Returns the input or element item value, without formatting, or defaultValue
         * if it's empty string, undefined, false or null
         * @param {type} defaultValue
         * @returns string|mixed
         */
        getSourceValue: function(defaultValue) {
            // returns the input or element value, as string
            defaultValue = defaultValue || this.options.defaultValue;
            var val = defaultValue;

            if (this.hasInput()) {
                val = this.input.val();
            } else {
                val = this.$element.data('iconpickerValue');
            }
            if ((val === undefined) || (val === '') || (val === null) || (val === false)) {
                // if not defined or empty, return default
                val = defaultValue;
            }
            return val;
        },
        hasInput: function() {
            return (this.input !== false);
        },
        isInputSearch: function() {
            return (this.hasInput() && (this.options.inputSearch === true));
        },
        isInputGroup: function() {
            return this.container.is('.input-group');
        },
        isDropdownMenu: function() {
            return this.container.is('.dropdown-menu');
        },
        hasSeparatedSearchInput: function() {
            return (this.options.templates.search !== false) && (!this.isInputSearch());
        },
        hasComponent: function() {
            return (this.component !== false);
        },
        hasContainer: function() {
            return (this.container !== false);
        },
        getAcceptButton: function() {
            return this.popover.find('.iconpicker-btn-accept');
        },
        getCancelButton: function() {
            return this.popover.find('.iconpicker-btn-cancel');
        },
        getSearchInput: function() {
            return this.popover.find('.iconpicker-search');
        },
        filter: function(filterText) {
            if (!filterText) {
                this.iconpicker.find('.iconpicker-item').show();
                return $(false);
            } else {
                var found = [];
                this.iconpicker.find('.iconpicker-item').each(function() {
                    var $this = $(this);
                    var text = $this.attr('title').toLowerCase();
                    var searchTerms = $this.attr('data-search-terms') ? $this.attr('data-search-terms').toLowerCase() : '';
                    text = text + ' ' + searchTerms;
                    var regex = false;
                    try {
                        regex = new RegExp('(^|\\W)' + filterText, 'g');
                    } catch (e) {
                        regex = false;
                    }
                    if ((regex !== false) && text.match(regex)) {
                        found.push($this);
                        $this.show();
                    } else {
                        $this.hide();
                    }
                });
                return found;
            }
        },
        show: function() {
            if (this.popover.hasClass('in')) {
                return false;
            }
            // hide other non-inline pickers
            IconPicker.batch($('.iconpicker-popover.in:not(.inline)').not(this.popover), 'hide');

            this.updatePlacement();
            this.popover.addClass('in');
            setTimeout(langx.proxy(function() {
                this.popover.css('display', this.isInline() ? '' : 'block');

            }, this), this.options.animation ? 300 : 1); // animation duration
        },
        hide: function() {
            if (!this.popover.hasClass('in')) {
                return false;
            }

            this.popover.removeClass('in');
            setTimeout(langx.proxy(function() {
                this.popover.css('display', 'none');
                this.getSearchInput().val('');
                this.filter(''); // clear filter

            }, this), this.options.animation ? 300 : 1);
        },
        toggle: function() {
            if (this.popover.is(":visible")) {
                this.hide();
            } else {
                this.show(true);
            }
        },
        update: function(val, updateOnlyInternal) {
            val = (val ? val : this.getSourceValue(this.iconpickerValue));
            // reads the input or element value again and tries to update the plugin
            // fallback to the current selected item value

            if (updateOnlyInternal === true) {
                val = this.setValue(val);
            } else {
                val = this.setSourceValue(val);
                this._updateFormGroupStatus(val !== false);
            }

            if (val !== false) {
                this._updateComponents();
            }

            return val;
        },
        destroy: function() {

            // unbinds events and resets everything to the initial state,
            // including component mode
            this.$element.removeData('iconpicker').removeData('iconpickerValue').removeClass('iconpicker-element');

            this._unbindElementEvents();
            this._unbindWindowEvents();

            $(this.popover).remove();

        },
        disable: function() {
            if (this.hasInput()) {
                this.input.prop('disabled', true);
                return true;
            }
            return false;
        },
        enable: function() {
            if (this.hasInput()) {
                this.input.prop('disabled', false);
                return true;
            }
            return false;
        },
        isDisabled: function() {
            if (this.hasInput()) {
                return (this.input.prop('disabled') === true);
            }
            return false;
        },
        isInline: function() {
            return (this.options.placement === 'inline') || (this.popover.hasClass('inline'));
        }

    });
  

    IconPicker.batch = function(selector, method) {
        var args = Array.prototype.slice.call(arguments, 2);
        return $(selector).each(function() {
            var $inst = $(this).plugin('lark.iconpicker');
            if (!!$inst) {
                $inst[method].apply($inst, args);
            }
        });
    };


    return skylark.attach("widgets.IconPicker",IconPicker);
});
