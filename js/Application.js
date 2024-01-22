/*
 Copyright 2022 Esri

 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at

 http://www.apache.org/licenses/LICENSE-2.0

 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License.
 */

import AppBase from "./support/AppBase.js";
import AppLoader from "./loaders/AppLoader.js";
import SignIn from './apl/SignIn.js';
import ViewLoading from './apl/ViewLoading.js';
import ColorRampCombobox from './apl/ColorRampCombobox.js';

class Application extends AppBase {

  // PORTAL //
  portal;

  validFieldValueTypes = ['count-or-amount', 'percentage-or-ratio', 'measurement'];
  iconByFieldValueType = {'count-or-amount': 'number', 'measurement': 'measure', 'percentage-or-ratio': 'percent'};

  validFieldTypes = ['small-integer', 'integer', 'single', 'double', 'long'];
  iconByFieldType = {'small-integer': 'number', 'integer': 'number', 'long': 'number', 'single': 'percent', 'double': 'percent'};

  fieldTypeToFieldValueType = {'small-integer': 'count-or-amount', 'integer': 'count-or-amount', 'long': 'count-or-amount', 'single': 'percentage-or-ratio', 'double': 'percentage-or-ratio'};

  constructor() {
    super();

    // LOAD APPLICATION BASE //
    super.load().then(() => {

      // APPLICATION LOADER //
      const applicationLoader = new AppLoader({app: this});
      applicationLoader.load().then(({portal, group, map, view}) => {
        //console.info(portal, group, map, view);

        // PORTAL //
        this.portal = portal;

        // VIEW SHAREABLE URL PARAMETERS //
        this.initializeViewShareable({view});

        // USER SIGN-IN //
        this.configUserSignIn();

        // SET APPLICATION DETAILS //
        this.setApplicationDetails({map, group});

        // APPLICATION //
        this.applicationReady({portal, group, map, view}).catch(this.displayError).then(() => {
          // HIDE APP LOADER //
          document.getElementById('app-loader').toggleAttribute('hidden', true);
        });

      }).catch(this.displayError);
    }).catch(this.displayError);

  }

  /**
   *
   */
  configUserSignIn() {

    const signInContainer = document.getElementById('sign-in-container');
    if (signInContainer) {
      const signIn = new SignIn({container: signInContainer, portal: this.portal});
    }

  }

  /**
   *
   * @param view
   */
  configView(view) {
    return new Promise((resolve, reject) => {
      if (view) {
        require([
          'esri/core/reactiveUtils',
          'esri/widgets/Popup',
          'esri/widgets/Home',
          'esri/widgets/Search',
          'esri/widgets/Legend',
          'esri/widgets/LayerList',
          'esri/widgets/Bookmarks'
        ], (reactiveUtils, Popup, Home, Search, Legend, LayerList, Bookmarks) => {

          // VIEW AND POPUP //
          view.set({
            //constraints: {snapToZoom: false},
            popup: new Popup({
              dockEnabled: true,
              dockOptions: {
                buttonEnabled: false,
                breakpoint: false,
                position: "top-right"
              }
            })
          });

          // SEARCH //
          const search = new Search({view: view});
          view.ui.add(search, {position: 'top-left', index: 0});

          // HOME //
          const home = new Home({view});
          view.ui.add(home, {position: 'top-left', index: 1});

          // LEGEND //
          const legend = new Legend({view: view});
          view.ui.add(legend, {position: 'bottom-left', index: 0});

          // BOOKMARKS //
          const bookmarks = new Bookmarks({container: 'bookmarks-container', view: view});

          // VIEW LOADING INDICATOR //
          const viewLoading = new ViewLoading({view: view});
          view.ui.add(viewLoading, 'bottom-right');

          resolve();
        });
      } else { resolve(); }
    });
  }

  /**
   *
   * @param portal
   * @param group
   * @param map
   * @param view
   * @returns {Promise}
   */
  applicationReady({portal, group, map, view}) {
    return new Promise(async (resolve, reject) => {
      // VIEW READY //
      this.configView(view).then(() => {

        // LAYER RENDERER //
        Promise.all([
          this.initializeFeatureDisplay({view}),
          this.initializeValueFormatter(),
          this.initializeHistogram({view}),
          this.initializeLayerRendering({view})
        ]).then(() => {

          // LAYERS LIST //
          this.initializeLayersList({view});

          resolve();
        });

      }).catch(reject);
    });
  }

  /**
   *
   * @param view
   * @returns {Promise<>}
   */
  initializeLayersList({view}) {
    return new Promise((resolve, reject) => {

      // ALL POLYGON FEATURE LAYERS //
      const featureLayers = view.map.layers.filter(layer => {
        return (layer.type === 'feature') && (layer.geometryType === 'polygon');
      });

      const featureLayerItems = featureLayers.map((featureLayer, featureLayerIdx) => {
        const featureLayerItem = document.createElement('calcite-combobox-item');
        featureLayerItem.setAttribute('value', featureLayer.id);
        featureLayerItem.setAttribute('text-label', featureLayer.title);
        featureLayerItem.setAttribute('icon', 'layer-polygon');
        featureLayerItem.toggleAttribute('selected', (featureLayerIdx === 0));
        return featureLayerItem;
      });

      const layerList = document.getElementById('layer-list');
      layerList.replaceChildren(...featureLayerItems);

      if (featureLayers.length) {
        this.initializeDisplayLayer({view, featureLayer: featureLayers.getItemAt(0)});
      } else {
        this.displayError({name: "Can't Find Layer", message: "You will need at least one polygon feature layer to use this application..."});
      }

      resolve();
    });
  }

  /**
   *
   * @param {MapView} view
   * @param {FeatureLayer} featureLayer
   */
  initializeDisplayLayer({view, featureLayer}) {

    const fieldsPanel = document.getElementById('fields-panel');
    fieldsPanel.setAttribute('heading', featureLayer.title);
    fieldsPanel.setAttribute('description', featureLayer.portalItem?.snippet);

    featureLayer.load().then(() => {
      this.initializeFieldsList({view, featureLayer});
    });

  }

  /**
   *
   * @param {MapView} view
   * @param {FeatureLayer} featureLayer
   */
  initializeFieldsList({view, featureLayer}) {

    const fieldsList = document.getElementById('fields-list');
    fieldsList.toggleAttribute('loading', true);

    const validFieldsByValueType = featureLayer.fields.filter(field => this.validFieldValueTypes.includes(field.valueType));
    //const validFieldsByType = featureLayer.fields.filter(field => this.validFieldTypes.includes(field.type));

    // VALID FIELDS //
    const validFields = validFieldsByValueType.filter(field => !field.name.startsWith("Shape__"));

    const fieldListItems = validFields.map((field, fieldIdx) => {
      const fieldListItem = document.createElement('calcite-list-item');
      fieldListItem.setAttribute('value', field.name);
      fieldListItem.setAttribute('metadata', field.toJSON());
      fieldListItem.setAttribute('label', field.alias || field.name);
      fieldListItem.setAttribute('description', field.description || '');
      fieldListItem.toggleAttribute('selected', (fieldIdx === 0));

      const fieldTypeAction = document.createElement('calcite-icon');
      fieldTypeAction.setAttribute('slot', 'content-end');
      fieldTypeAction.setAttribute('scale', 's');
      //fieldTypeAction.setAttribute('icon', this.iconByFieldType[field.type]);
      fieldTypeAction.setAttribute('icon', this.iconByFieldValueType[field.valueType]);
      fieldListItem.append(fieldTypeAction);

      return fieldListItem;
    });

    fieldsList.replaceChildren(...fieldListItems);
    fieldsList.toggleAttribute('loading', false);

    fieldsList.addEventListener('calciteListItemSelect', () => {
      requestAnimationFrame(() => {
        const selectedItems = fieldsList.querySelectorAll("[selected]");
        if (selectedItems?.length) {
          const selectedField = featureLayer.getField(selectedItems[0].value);
          this.dispatchEvent(new CustomEvent('field-change', {detail: {selectedLayer: featureLayer, selectedField}}));
        }
      });
    });

    const selectedField = validFields[0];
    this.dispatchEvent(new CustomEvent('field-change', {detail: {selectedLayer: featureLayer, selectedField}}));
  }

  /**
   *
   * https://developers.arcgis.com/javascript/latest/visualization/symbols-color-ramps/esri-color-ramps/
   *
   * COLOR
   * https://developers.arcgis.com/javascript/latest/api-reference/esri-smartMapping-renderers-color.html
   *
   * SIZE
   * https://developers.arcgis.com/javascript/latest/api-reference/esri-smartMapping-renderers-size.html
   *
   * @param view
   */
  initializeLayerRendering({view}) {
    return new Promise((resolve, reject) => {
      require([
        "esri/core/reactiveUtils",
        "esri/smartMapping/popup/templates",
        "esri/smartMapping/symbology/support/colorRamps",
        "esri/smartMapping/symbology/color",
        "esri/smartMapping/renderers/color",
        "esri/symbols/support/symbolUtils"
      ], (reactiveUtils, popupTemplateCreator, colorRamps, colorSchemes, colorRendererCreator, symbolUtils) => {

        let _selectedLayer;
        let _selectedField;

        // SMARTMAPPING POPUP //
        const _setSmartMappingPopup = (layer, places) => {
          popupTemplateCreator.getTemplates({layer: layer, renderer: layer.renderer}).then((popupTemplateResponse) => {
            if (popupTemplateResponse.primaryTemplate) {
              const suggestedTemplate = popupTemplateResponse.primaryTemplate.value;
              suggestedTemplate.fieldInfos[0].format.places = places;
              layer.popupTemplate = suggestedTemplate;
            }
          }).catch(console.error);
        };

        const colorSchemeAB = new ColorRampCombobox({
          container: 'color-ramps-container',
          icon: 'percent',
          theme: 'above-and-below',
          basemap: view.map.basemap,
          geometryType: 'polygon'
        });
        colorSchemeAB.addEventListener('color-ramp-select', () => {
          updateLayerRendering();
        });

        const colorSchemeHL = new ColorRampCombobox({
          container: 'color-ramps-container',
          icon: 'number',
          theme: 'high-to-low',
          basemap: view.map.basemap,
          geometryType: 'polygon'
        });
        colorSchemeHL.addEventListener('color-ramp-select', () => {
          updateLayerRendering();
        });

        const updateLayerRendering = () => {
          const valueType = _selectedField.valueType;
          const theme = (valueType === 'percentage-or-ratio') ? 'above-and-below' : 'high-to-low';
          const colorScheme = (theme === 'above-and-below') ? colorSchemeAB.selectedColorScheme : colorSchemeHL.selectedColorScheme;

          colorSchemeAB.toggleAttribute('hidden', (theme !== 'above-and-below'));
          colorSchemeHL.toggleAttribute('hidden', (theme !== 'high-to-low'));

          // DEFAULT SMART MAPPING OPTIONS //
          const defaultOptions = {
            view: view,
            layer: _selectedLayer,
            field: _selectedField.name,
            theme: theme,
            colorScheme,
            outlineOptimizationEnabled: true,
            defaultSymbolEnabled: true
          };

          colorRendererCreator.createContinuousRenderer(defaultOptions).then((response) => {
            _selectedLayer.set({
              visible: true,
              renderer: response.renderer
            });
          });

          reactiveUtils.whenOnce(() => !view.updating).then(() => {
            this.dispatchEvent(new CustomEvent('renderer-change', {detail: {selectedLayer: _selectedLayer, selectedField: _selectedField}}));
          }, {initial: false});
        };

        this.addEventListener("field-change", ({detail: {selectedLayer, selectedField}}) => {
          _selectedLayer = selectedLayer;
          _selectedField = selectedField;
          updateLayerRendering();
        });

        resolve();
      });
    });
  }

  /**
   * https://developers.arcgis.com/javascript/latest/sample-code/sandbox/?sample=visualization-update-data
   *
   * https://developers.arcgis.com/javascript/latest/api-reference/esri-smartMapping-statistics-histogram.html#histogram
   *
   * https://developers.arcgis.com/javascript/latest/sample-code/sandbox/?sample=visualization-sm-color
   *
   * @param view
   * @returns {Promise<>}
   */
  initializeHistogram({view}) {
    return new Promise((resolve, reject) => {
      require([
        'esri/core/promiseUtils',
        'esri/core/reactiveUtils',
        'esri/Color',
        "esri/smartMapping/statistics/summaryStatistics",
        "esri/smartMapping/statistics/histogram",
        "esri/widgets/Histogram"
      ], (promiseUtils, reactiveUtils, Color, summaryStatistics, histogram, Histogram) => {

        // HANDLE ABORT ERRORS //
        const _handleAbortError = error => (!promiseUtils.isAbortError(error)) && console.error(error);

        const getColorFromValue = ({layer, value}) => {

          const visualVariable = layer.renderer.visualVariables.find(vv => vv.type === "color");

          const stops = visualVariable.stops;
          let minStop = stops[0];
          let maxStop = stops[stops.length - 1];

          let minStopValue = minStop.value;
          let maxStopValue = maxStop.value;

          if (value < minStopValue) { return minStop.color; }
          if (value > maxStopValue) { return maxStop.color; }

          const exactMatches = stops.filter(stop => stop.value === value);
          if (exactMatches.length > 0) { return exactMatches[0].color; }

          minStop = null;
          maxStop = null;
          stops.forEach((stop, stopIdx) => {
            if (!minStop && !maxStop && stop.value >= value) {
              minStop = stops[stopIdx - 1];
              maxStop = stop;
            }
          });

          const weightedPosition = (value - minStop.value) / (maxStop.value - minStop.value);
          return Color.blendColors(minStop.color, maxStop.color, weightedPosition);
        };

        const statLabelMin = document.getElementById('stat-label-min');
        const statLabelMax = document.getElementById('stat-label-max');

        const statCountLabel = document.getElementById('stat-count-label');
        const statSumLabel = document.getElementById('stat-sum-label');
        const statMinLabel = document.getElementById('stat-min-label');
        const statMaxLabel = document.getElementById('stat-max-label');
        const statAvgLabel = document.getElementById('stat-avg-label');
        const statMedianLabel = document.getElementById('stat-median-label');
        const statStdevLabel = document.getElementById('stat-stdev-label');
        //const statVarianceLabel = document.getElementById('stat-variance-label');

        let histogramChart = null;
        const histogramContainer = document.getElementById('histogram-container');

        const _updateHistogram = promiseUtils.debounce(({selectedLayer, selectedField, signal}) => {

          const params = {
            layer: selectedLayer,
            field: selectedField.name,
            view: view,
            useFeaturesInView: true,
            numBins: 40,
            signal
          };

          summaryStatistics(params).then((stats) => {
            if (!params.signal.aborted) {

              statLabelMin.innerHTML = this.formatValue(stats.min);
              statLabelMax.innerHTML = this.formatValue(stats.max);

              statCountLabel.innerHTML = this.formatValue(stats.count, 0);
              statSumLabel.innerHTML = this.formatValue(stats.sum);
              statMinLabel.innerHTML = this.formatValue(stats.min);
              statMaxLabel.innerHTML = this.formatValue(stats.max);
              statAvgLabel.innerHTML = this.formatValue(stats.avg);
              statMedianLabel.innerHTML = this.formatValue(stats.median);
              statStdevLabel.innerHTML = this.formatValue(stats.stddev);
              //statVarianceLabel.innerHTML = this.formatValue(statsResponse.variance);

              params.minValue = stats.min;
              params.maxValue = stats.max;
              params.classificationMethod = 'equal-interval';

              histogram(params).then((histogramResult) => {
                if (!params.signal.aborted) {

                  const histogramProps = {
                    average: stats.avg,
                    bins: histogramResult.bins,
                    min: histogramResult.minValue,
                    max: histogramResult.maxValue
                  };

                  histogramChart && histogramChart.destroy();
                  const container = document.createElement('div');
                  histogramContainer.replaceChildren(container);

                  const avgMinusStDev = (stats.avg - stats.stddev);
                  const avgPlusStDev = (stats.avg + stats.stddev);

                  histogramChart = new Histogram({
                    container: container,
                    ...histogramProps,
                    dataLines: [
                      {label: this.formatValue(avgMinusStDev), value: avgMinusStDev},
                      //{label:floatFormatter.format(stats.avg), value: stats.avg},
                      {label: this.formatValue(avgPlusStDev), value: avgPlusStDev}
                    ],
                    labelFormatFunction: (value, type) => {
                      return type === "average" ? value.toFixed(2) : value;
                    },
                    barCreatedFunction: (index, element) => {
                      const bin = histogramChart.bins[index];
                      const midValue = bin.minValue + ((bin.maxValue - bin.minValue) * 0.5);
                      const color = getColorFromValue({layer: selectedLayer, value: midValue});
                      element.setAttribute("fill", color.toHex());
                    }
                  });
                }
              }).catch(_handleAbortError);
            }
          }).catch(_handleAbortError);

        });

        let _selectedLayer;
        let _selectedField;
        let abortController;

        const __updateHistogram = () => {
          if (_selectedLayer && _selectedField) {
            abortController?.abort();
            abortController = new AbortController();
            _updateHistogram({selectedLayer: _selectedLayer, selectedField: _selectedField, signal: abortController.signal}).catch(_handleAbortError);
          }
        };
        this.addEventListener("precision-change", ({}) => {
          __updateHistogram();
        });
        this.addEventListener("renderer-change", ({detail: {selectedLayer, selectedField}}) => {
          _selectedLayer = selectedLayer;
          _selectedField = selectedField;
          __updateHistogram();
        });
        reactiveUtils.when(() => view.stationary, () => {
          if (_selectedLayer && _selectedField) {
            reactiveUtils.whenOnce(() => !view.updating).then(() => {
              __updateHistogram();
            }, {initial: true});
          }
        }, {initial: true});

        resolve();
      });
    });
  }

  initializeValueFormatter() {
    return new Promise((resolve, reject) => {

      const formatterByPrecision = new Map();
      const getFormatter = precision => {
        let formatter = formatterByPrecision.get(precision);
        if (!formatter) {
          formatter = new Intl.NumberFormat('default', {minimumFractionDigits: precision, maximumFractionDigits: precision});
          formatterByPrecision.set(precision, formatter);
        }
        return formatter;
      };
      getFormatter(0);
      getFormatter(1);
      getFormatter(2);

      const precisionInput = document.getElementById('precision-input');
      precisionInput.addEventListener('calciteInputNumberChange', () => {
        getFormatter(+precisionInput.value);
        this.dispatchEvent(new CustomEvent('precision-change', {detail: {}}));
      });

      this.formatValue = (value, precision = +precisionInput.value) => {
        let formatter = getFormatter(precision);
        return formatter.format(value);
      };

      resolve();
    });
  }

  /**
   *
   * @param view
   */
  initializeFeatureDisplay({view}) {
    return new Promise((resolve, reject) => {
      require([
        'esri/core/reactiveUtils',
        "esri/smartMapping/popup/templates",
        'esri/widgets/Feature'
      ], (reactiveUtils, popupTemplateCreator, Feature) => {

        const feature = new Feature({
          container: 'feature-container',
          view: view
        });

        let _selectedField;
        let _selectedLayer;
        let _selectedLayerView;
        this.addEventListener("renderer-change", ({detail: {selectedLayer, selectedField}}) => {
          _selectedLayer = selectedLayer;
          _selectedField = selectedField;
          view.whenLayerView(_selectedLayer).then(selectedLayerView => {
            _selectedLayerView = selectedLayerView;
            _selectedLayerView.highlightOptions = {
              color: "#007472",
              haloOpacity: 0.8,
              fillOpacity: 0.3
            };
          });
        });

        let abortController;
        let _highlight;
        reactiveUtils.on(() => view, 'pointer-move', (pointerEvt) => {
          abortController?.abort();
          abortController = new AbortController();
          view.hitTest(pointerEvt, {include: [_selectedLayer]}).then((response) => {
            _highlight?.remove();
            if (!abortController.aborted && response.results.length) {

              const hitGraphic = response.results[0].graphic;
              if (hitGraphic.layer.renderer) { // && (hitGraphic.getObjectId() !== feature.graphic?.getObjectId())) {

                popupTemplateCreator.getTemplates({
                  layer: hitGraphic.layer,
                  renderer: hitGraphic.layer.renderer
                }).then((popupTemplateResponse) => {
                  if (popupTemplateResponse.primaryTemplate) {
                    hitGraphic.layer.popupTemplate = popupTemplateResponse.primaryTemplate.value;
                    hitGraphic.layer.popupTemplate.set({
                      title: _selectedLayer.title
                    });
                    feature.graphic = hitGraphic;
                    _highlight = _selectedLayerView.highlight(hitGraphic);
                  } else {
                    feature.graphic = null;
                  }
                });
              } else {
                feature.graphic = null;
              }
            } else {
              feature.graphic = null;
            }
          });
        });

        resolve();
      });
    });
  }

}

export default new Application();

