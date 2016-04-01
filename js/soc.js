var soc = (function() {
    var scrollDuration = 800;

    var markerAnimationDuration = 280;
    var markerZIndexMin = 100001;
    var markerZIndexMax;

    var hostName = location.hostname;
    var docHeight = $(document).height();
    var isIncognito;
    var reservedYPositions = [];
    var reservedMarkerHeight = 28;
    var headings = {};
    var headingMarkers = {};
    var markersCreated = false;

    var hostVisibilityOverrideKey = "visibilityOverride-" + hostName;
    var hostDisplayOverrideKey = "displayOverride-" + hostName;
    var storageKeysToGet = {};

    // User-customizable variables
    var defaultDisplay,
        socMarkerDefaultVisibility,
        socMarkerDefaultDisplay,
        socMarkerVisibility,
        socMarkerDisplay,
        socMarkerTextLength,
        socMarkerOpacity,
        hostDisplayOverride,
        hostVisibilityOverride,
        maxHeadingHierarchy,
        preventOverlap;

    var retrieveOptions = function() {
        // Set stored values' keys and default values
        storageKeysToGet = {
            "displayOption": "hidden",
            "textLengthOption": "firstThreeWords",
            "opacityOption": .91,
            "levelOption": 3,
            "overlapOption": true
        }

        storageKeysToGet[hostVisibilityOverrideKey] = "";
        storageKeysToGet[hostDisplayOverrideKey] = "";

        chrome.storage.sync.get(storageKeysToGet, function(options) {
            defaultDisplay = options.displayOption;
            socMarkerTextLength = options.textLengthOption;
            socMarkerOpacity = options.opacityOption;
            maxHeadingHierarchy = options.levelOption;
            preventOverlap = options.overlapOption;
            hostVisibilityOverride = options[hostVisibilityOverrideKey];
            hostDisplayOverride = options[hostDisplayOverrideKey];

            markerZIndexMax = markerZIndexMin + maxHeadingHierarchy;

            /*------------------------------------------------
                Set default and initial markers visibility 
                and display.
            ------------------------------------------------*/
            switch (defaultDisplay) {
                case "maximized":
                    socMarkerDefaultVisibility = socMarkerVisibility = "visible";
                    socMarkerDefaultDisplay = socMarkerDisplay = "maximized";
                    break;

                case "minimized":
                    socMarkerDefaultVisibility = socMarkerVisibility = "visible";
                    socMarkerDefaultDisplay = socMarkerDisplay = "minimized";
                    break;

                case "hidden":
                    socMarkerDefaultVisibility = socMarkerVisibility = "hidden";
                    socMarkerDefaultDisplay = socMarkerDisplay = "maximized";
                    break;
            }

            /*------------------------------------------------
                If there are overrides for current hostname,
                set initial visibility and display styles
            ------------------------------------------------*/
            if (hostVisibilityOverride !== "") {
                socMarkerVisibility = hostVisibilityOverride;
            }

            if (hostDisplayOverride !== "") {
                socMarkerDisplay = hostDisplayOverride;
            }

            /*------------------------------------------------
                If markers have been created, always recreate 
                them (even if socMarkerVisibility is hidden,
                in case the user changes the default 
                to hidden from the options page in the middle 
                of viewing a page).
            ------------------------------------------------*/
            if (markersCreated === true || socMarkerVisibility !== "hidden") {
                createHeadingMarkers();
            }
        });
    };

    var toggleMarkerVisibility = function(setOverride) {
        if (markersCreated === false) {
            createHeadingMarkers();
        }

        if (!setOverride) setOverride = true;

        if (socMarkerVisibility === "hidden") {
            showMarkers(setOverride);
        } else if (socMarkerVisibility === "visible") {
            hideMarkers(setOverride);
        }
    };

    var showMarkers = function(setOverride) {
        $(".soc-marker").css({ "display": "block", "opacity": 0 });
        $(".soc-marker").animate({ "opacity": socMarkerOpacity }, markerAnimationDuration);

        socMarkerVisibility = "visible";

        if (setOverride && !isIncognito) {
            updateVisibilityOverride();
        }
    };

    var hideMarkers = function(setOverride) {
        $(".soc-marker").animate({ "opacity": 0 }, markerAnimationDuration, function() {
            $(".soc-marker").css({ "display": "none" });
        });

        socMarkerVisibility = "hidden";

        if (setOverride && !isIncognito) {
            updateVisibilityOverride();
        }
    };

    var toggleMarkerDisplay = function(setOverride) {
        if (markersCreated === false) {
            createHeadingMarkers();
        }

        if (!setOverride) setOverride = true;

        if (socMarkerDisplay === "maximized") {
            minimizeMarkers(setOverride);
        } else if (socMarkerDisplay == "minimized") {
            maximizeMarkers(setOverride);
        }
    };

    var maximizeMarkers = function(setOverride) {
        $(".soc-marker__text").css({ "display": "inline" });

        socMarkerDisplay = "maximized";

        if (setOverride && !isIncognito) {
            updateDisplayOverride();
        }
    }

    var minimizeMarkers = function(setOverride) {
        $(".soc-marker__text").css({ "display": "none" });

        socMarkerDisplay = "minimized";

        if (setOverride && !isIncognito) {
            updateDisplayOverride();
        }
    }

    /*------------------------------------------------
      Saves or removes visibility override for 
      current hostname
    ------------------------------------------------*/
    var updateVisibilityOverride = function() {
        if (socMarkerVisibility !== socMarkerDefaultVisibility) {
            storageKeysToGet = {};
            storageKeysToGet[hostVisibilityOverrideKey] = socMarkerVisibility;
            chrome.storage.sync.set(storageKeysToGet);
        } else {
            chrome.storage.sync.remove(hostVisibilityOverrideKey);
        }
    }

    /*------------------------------------------------
      Saves or removes display override for 
      current hostname
    ------------------------------------------------*/
    var updateDisplayOverride = function() {
        if (socMarkerDisplay !== socMarkerDefaultDisplay) {
            storageKeysToGet = {};
            storageKeysToGet[hostDisplayOverrideKey] = socMarkerDisplay;
            chrome.storage.sync.set(storageKeysToGet);
        } else {
            chrome.storage.sync.remove(hostDisplayOverrideKey);
        }
    }

    var onKeyDown = function(e) {
        // shift-alt-m
        if (e.keyCode == 77) {
            if (e.shiftKey && e.altKey) {
                e.preventDefault();
                toggleMarkerDisplay();
            }
        }

        // shift-alt-n
        else if (e.keyCode == 78) {
            if (e.shiftKey && e.altKey) {
                e.preventDefault();
                toggleMarkerVisibility();
            }
        }
    };

    var createHeadingMarkers = function() {
        if (!$.isEmptyObject(headingMarkers)) {
            $(".soc-marker").remove();
            headings = {};
            headingMarkers = {};
        }

        if (preventOverlap) reservedYPositions.length = 0;

        headings = getHeadingsFromPage();

        for (var i = 0; i < headings.length; i++) {
            var markerId = "soc-" + (i + 1);

            headingMarkers[markerId] = new HeadingMarker(headings[i], markerId);

            $("body").append(headingMarkers[markerId].domElement);

            headingMarkers[markerId].setPosition();
        }

        // If markers have not been created previously, attach listener
        if (markersCreated == false) {
            window.onresize = function() { updateMarkerPositions() };
            window.setInterval(onIntervalTick, 100);
        }

        /*------------------------------------------------
          Display heading markers
        ------------------------------------------------*/
        if (socMarkerVisibility === "visible") {
            if (markersCreated === false) {
                $(".soc-marker")
                    .css({ "display": "block", "opacity": 0 })
                    .animate({ "opacity": socMarkerOpacity }, markerAnimationDuration);
            } else {
                $(".soc-marker").css({ "display": "block", "opacity": socMarkerOpacity });
            }
        }

        markersCreated = true;
    };

    var getHeadingsFromPage = function() {
        var headingsTemp = [];

        for (var i = 0; i < maxHeadingHierarchy; i++) {
            var headingTagName = "h" + (i + 1);
            var headingsInCurrentHierarchy = document.getElementsByTagName(headingTagName);
            var headingsInCurrentHierarchyLength = headingsInCurrentHierarchy.length;

            if (headingsInCurrentHierarchy[0] !== undefined) {
                for (var j = 0; j < headingsInCurrentHierarchyLength; j++) {

                    /*------------------------------------------------
                      Filter heading
                    ------------------------------------------------*/
                    var filteredHeading = soc.filterHeading(headingsInCurrentHierarchy[j]);

                    if (filteredHeading.markHeading === true) {
                        headingsInCurrentHierarchy[j].headingText = filteredHeading.filteredHeadingText;
                        headingsTemp.push(headingsInCurrentHierarchy[j]);
                    }
                }
            }
        }

        return headingsTemp;
    };

    /*------------------------------------------------
      Finds an html element's position relative to 
      the document.
    ------------------------------------------------*/
    var findPosition = function(headingElement) {
        var topPos = leftPos = 0;

        do {
            topPos += headingElement.offsetTop;
            leftPos += headingElement.offsetLeft;
        }
        while (headingElement = headingElement.offsetParent);

        return { "topPos": topPos, "leftPos": leftPos };
    };

    var updateMarkerPositions = function() {
        var headingMarkersKeys = Object.keys(headingMarkers);
        
        if (preventOverlap) reservedYPositions.length = 0;

        for (var i = 0; i < headingMarkersKeys.length; i++) {
            headingMarkers[headingMarkersKeys[i]].setPosition();
        }
    };

    var onIntervalTick = function() {
        var currentDocHeight = $(document).height();

        if (docHeight !== currentDocHeight) {
            docHeight = currentDocHeight;
            updateMarkerPositions();
        }
    };

    var HeadingMarker = function(headingElement, markerId) {

        var createMarker = function() {
            var newMarker = document.createElement("div");
            newMarker.setAttribute("id", markerId);
            newMarker.setAttribute("class", "soc-marker");

            var newMarkerText = document.createElement("span");
            newMarkerText.setAttribute("class", "soc-marker__text");
            newMarkerText.innerHTML = this.displayText;

            if (socMarkerDisplay === "minimized") {
                $(newMarkerText).css({ "display": "none" });
            }

            newMarker.appendChild(newMarkerText);

            $(newMarker).css({ "z-index": this.zIndex, "display": "none" });

            return newMarker;
        }

        /*------------------------------------------------
          Marker properties
        ------------------------------------------------*/
        this.headingDomElement = headingElement;
        this.markerId = markerId;
        this.tagName = headingElement.tagName.toLowerCase();
        this.headingText = headingElement.headingText;
        this.topPos = findPosition(headingElement).topPos;
        this.zIndex = markerZIndexMin + (maxHeadingHierarchy - this.tagName.split("h")[1]);

        switch (socMarkerTextLength) {
            case "firstThreeWords":
                var headingTextArray = headingElement.headingText.split(" ");

                if (headingTextArray.length > 3) {
                    this.displayText = headingTextArray.splice(0, 3).join(" ") + "...";
                } else {
                    this.displayText = headingElement.headingText;
                }
                break;

            case "firstTenCharacters":
                if (headingElement.headingText.length > 10) {
                    this.displayText = headingElement.headingText.substr(0, 10) + "...";
                } else {
                    this.displayText = headingElement.headingText;
                }
                break;

            case "entireText":
            default:
                this.displayText = headingElement.headingText;
        }

        /*------------------------------------------------
          Create a new marker
        ------------------------------------------------*/
        var newMarker = createMarker.apply(this);

        $(newMarker).mouseenter(this.onMouseEnter);
        $(newMarker).mouseleave(this.onMouseLeave);

        newMarker.addEventListener("click", this.onClick, false);

        this.domElement = newMarker;

        // $( "body" ).append( newMarker );
    };

    HeadingMarker.prototype.onMouseEnter = function() {
        var markerId = this.getAttribute("id");
        var markerText = $(this).find(".soc-marker__text");

        markerText.text(headingMarkers[markerId].headingText);

        if (socMarkerDisplay === "minimized") markerText.css({ "display": "inline" });

        $(this).css({
            "z-index": markerZIndexMax,
            "opacity": 1
        });
    };

    HeadingMarker.prototype.onMouseLeave = function() {
        var markerId = this.getAttribute("id");
        var markerText = $(this).find(".soc-marker__text");

        markerText.text(headingMarkers[markerId].displayText);

        if (socMarkerDisplay === "minimized") markerText.css({ "display": "none" });

        $(this).css({
            "z-index": headingMarkers[markerId].zIndex,
            "opacity": socMarkerOpacity
        });
    };

    HeadingMarker.prototype.onClick = function() {
        $.scrollTo(headingMarkers[this.getAttribute("id")].topPos,
            {
                duration: scrollDuration,
                easing: "swing"
            });
    };

    HeadingMarker.prototype.setPosition = function() {
        var winToDocHeightRatio = $(window).height() / docHeight;

        /*------------------------------------------------
            Update marker's topPos
        ------------------------------------------------*/
        this.topPos = findPosition(this.headingDomElement).topPos;

        /*------------------------------------------------
            Reserve y positions then place each marker
        ------------------------------------------------*/
        var markerTopPos = Number((winToDocHeightRatio * this.topPos).toFixed());

        if (preventOverlap === true) {
            // Check if y position is reserved
            for (var i = 0; i < reservedYPositions.length; i++) {
                if (markerTopPos === reservedYPositions[i]) {
                    markerTopPos++;
                }
            }

            this.reservedTopPos = [];

            /*------------------------------------------------
              Reserve every pixels needed to show the marker
            ------------------------------------------------*/
            for (var j = 0; j < reservedMarkerHeight; j++) {
                this.reservedTopPos.push(markerTopPos + j);

                reservedYPositions.push(markerTopPos + j);
            }
        }

        $(this.domElement).css({ "top": markerTopPos });
    };

    return {
        init: function() {
            chrome.runtime.sendMessage({ query: "checkIncognito" }, function(response) {
                isIncognito = response.incognito;
                retrieveOptions();
            });

            /*------------------------------------------------
              Listen for tab updates and tab selection changes
              to keep tab data up to date and to make
              options page changes take effect immediately.
            ------------------------------------------------*/
            chrome.extension.onMessage.addListener(function(request, sender, sendResponse) {
                switch (request.tabEvent) {
                    case "selectionChanged":
                        retrieveOptions();
                        break;

                    case "updated":
                        // Update markers if they have been created
                        if (markersCreated === true) {
                            createHeadingMarkers();
                        }
                        break;

                    case "browserActionClicked":
                        toggleMarkerVisibility();
                        break;
                }

                // Close the request
                sendResponse({});
            });

            /*------------------------------------------------
             Add keyboard shortcuts.
            ------------------------------------------------*/
            document.addEventListener("keydown", onKeyDown, false);
        },
    };
})();

$(function() {
    soc.init();
});