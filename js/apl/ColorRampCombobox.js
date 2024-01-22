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
/**
 *
 * ColorRampCombobox
 *  - Element: apl-color-ramp-combobox
 *  - Description: Color Ramp Combobox
 *
 * Author:   John Grayson - Applications Prototype Lab - Esri
 * Created:  2/22/2023 - 0.0.1 -
 * Modified:
 *
 */

class ColorRampCombobox extends HTMLElement {

  static version = '0.0.1';

  static COLOR_RAMP_SIZE = {width: 345, height: 16};

  /**
   * @type {HTMLElement}
   */
  container;

  /**
   * @type {string}
   */
  #theme;

  /**
   * @type {Basemap}
   */
  #basemap;

  /**
   * @type {string}
   */
  #geometryType;

  /**
   * @type {{}[]}
   */
  #allSchemes;

  /**
   * @type {{}}
   */
  #selectedColorScheme;

  get selectedColorScheme() {
    return this.#selectedColorScheme;
  }

  /**
   *
   */
  constructor({container, theme, basemap, geometryType}) {
    super();

    this.container = (container instanceof HTMLElement) ? container : document.getElementById(container);

    this.#theme = theme;
    this.#basemap = basemap;
    this.#geometryType = geometryType;

    const shadowRoot = this.attachShadow({mode: 'open'});
    shadowRoot.innerHTML = `
      <style>
        :host {}      
      </style>
      <calcite-combobox placeholder="Select a color ramp" selection-mode="single"></calcite-combobox>   
    `;

    this.container?.append(this);
  }

  /**
   *
   */
  connectedCallback() {

    this.colorRampList = this.shadowRoot.querySelector('calcite-combobox');

    this.initializeColorSchemes();

  }

  initializeColorSchemes() {
    require([
      'esri/core/reactiveUtils',
      "esri/smartMapping/symbology/color",
      "esri/symbols/support/symbolUtils"
    ], (reactiveUtils, smColorSchemes, symbolUtils) => {

      const colorSchemes = smColorSchemes.getSchemes({theme: this.#theme, basemap: this.#basemap, geometryType: this.#geometryType});

      this.#allSchemes = [...colorSchemes.secondarySchemes];
      if (!colorSchemes.secondarySchemes.find(scheme => scheme.id === colorSchemes.primaryScheme.id)) {
        this.#allSchemes.unshift(colorSchemes.primaryScheme);
      }

      const colorRampNodes = this.#allSchemes.map(scheme => {
        const colorRamp = symbolUtils.renderColorRampPreviewHTML(scheme.colors, {align: 'horizontal', ...ColorRampCombobox.COLOR_RAMP_SIZE});
        const colorRampNode = document.createElement('calcite-combobox-item');
        colorRampNode.setAttribute('value', scheme.id);
        colorRampNode.setAttribute('text-label', scheme.name);
        colorRampNode.toggleAttribute('selected', (scheme.id === colorSchemes.primaryScheme.id));
        colorRampNode.append(colorRamp);
        return colorRampNode;
      });

      this.colorRampList.replaceChildren(...colorRampNodes);
      this.colorRampList.addEventListener('calciteComboboxChange', () => {
        this.#selectedColorScheme = this.#allSchemes?.find(colorScheme => colorScheme.id === this.colorRampList.value);
        this.dispatchEvent(new CustomEvent('color-ramp-select', {detail: {selectedColorScheme: this.#selectedColorScheme}}));
      });

      this.#selectedColorScheme = this.#allSchemes?.find(colorScheme => colorScheme.id === colorSchemes.primaryScheme.id);

    });
  }

}

customElements.define("apl-color-ramp-combobox", ColorRampCombobox);

export default ColorRampCombobox;
