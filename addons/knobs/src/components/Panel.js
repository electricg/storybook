import React, { PureComponent, Fragment } from 'react';
import PropTypes from 'prop-types';
import qs from 'qs';
import { document } from 'global';
import { styled } from '@storybook/theming';
import copy from 'copy-to-clipboard';

import { STORY_CHANGED } from '@storybook/core-events';
import {
  Placeholder,
  TabWrapper,
  TabsState,
  ActionBar,
  Link,
  ScrollArea,
} from '@storybook/components';
import { RESET, SET, CHANGE, SET_OPTIONS, CLICK } from '../shared';

import Types from './types';
import PropForm from './PropForm';

const getTimestamp = () => +new Date();

export const DEFAULT_GROUP_ID = 'Other';

const PanelWrapper = styled(({ children, className }) => (
  <ScrollArea horizontal vertical className={className}>
    {children}
  </ScrollArea>
))({
  height: '100%',
  width: '100%',
});

export default class KnobPanel extends PureComponent {
  constructor(props) {
    super(props);
    this.state = {
      knobs: {},
    };
    this.options = {};

    this.lastEdit = getTimestamp();
    this.loadedFromUrl = false;
  }

  componentDidMount() {
    this.mounted = true;
    const { api } = this.props;
    api.on(SET, this.setKnobs);
    api.on(SET_OPTIONS, this.setOptions);

    this.stopListeningOnStory = api.on(STORY_CHANGED, () => {
      if (this.mounted) {
        this.setKnobs({ knobs: {} });
      }
      this.setKnobs({ knobs: {} });
    });
  }

  componentWillUnmount() {
    this.mounted = false;
    const { api } = this.props;

    api.off(SET, this.setKnobs);
    this.stopListeningOnStory();
  }

  setOptions = (options = { timestamps: false }) => {
    this.options = options;
  };

  setKnobs = ({ knobs, timestamp }) => {
    const queryParams = {};
    const { api } = this.props;

    if (!this.options.timestamps || !timestamp || this.lastEdit <= timestamp) {
      Object.keys(knobs).forEach(groupId => {
        const group = knobs[groupId];
        Object.keys(group).forEach(name => {
          const knob = group[name];
          // For the first time, get values from the URL and set them.
          if (!this.loadedFromUrl) {
            const urlValue = api.getQueryParam([`knob-${groupId}`, name]);

            // If the knob value present in url
            if (urlValue !== undefined) {
              const value = Types[knob.type].deserialize(urlValue);
              knob.value = value;
              queryParams[`knob-${groupId}[${name}]`] = Types[knob.type].serialize(value);

              api.emit(CHANGE, knob);
            }
          }
        });
      });

      api.setQueryParams(queryParams);
      this.setState({ knobs });

      this.loadedFromUrl = true;
    }
  };

  reset = () => {
    const { api } = this.props;

    api.emit(RESET);
  };

  copy = () => {
    const { location } = document;
    const query = qs.parse(location.search, { ignoreQueryPrefix: true });
    const { knobs } = this.state;

    Object.entries(knobs).forEach(([groupId, group]) => {
      Object.entries(group).forEach(([name, knob]) => {
        query[`knob-${groupId}[${name}]`] = Types[knob.type].serialize(knob.value);
      });
    });

    copy(`${location.origin + location.pathname}?${qs.stringify(query, { encode: false })}`);

    // TODO: show some notification of this
  };

  emitChange = changedKnob => {
    const { api } = this.props;

    api.emit(CHANGE, changedKnob);
  };

  handleChange = changedKnob => {
    this.lastEdit = getTimestamp();
    const { knobs } = this.state;
    const { groupId, name } = changedKnob;
    const newKnobs = { ...knobs };
    newKnobs[groupId][name] = {
      ...newKnobs[groupId][name],
      ...changedKnob,
    };

    this.setState({ knobs: newKnobs }, this.emitChange(changedKnob));
  };

  handleClick = knob => {
    const { api } = this.props;

    api.emit(CLICK, knob);
  };

  render() {
    const { knobs } = this.state;
    const { active: panelActive } = this.props;
    if (!panelActive) {
      return null;
    }

    // Always sort DEFAULT_GROUP_ID (ungrouped) tab last without changing the remaining tabs
    const { '': other, ...sorted } = knobs;
    if (other) {
      sorted[''] = Object.values(other).reduce((acc, item) => {
        acc[item.name] = {
          ...item,
          groupId: '',
        };
        return acc;
      }, {});
    }

    const knobKeysArray = Object.keys(sorted);
    // TODO
    // .filter(
    //   groupId => Object.values(knobs[groupId]).filter(({ used }) => used).length
    // );

    if (knobKeysArray.length === 0) {
      return (
        <Placeholder>
          <Fragment>No knobs found</Fragment>
          <Fragment>
            Learn how to{' '}
            <Link
              href="https://github.com/storybooks/storybook/tree/master/addons/knobs"
              target="_blank"
              withArrow
            >
              dynamically interact with components
            </Link>
          </Fragment>
        </Placeholder>
      );
    }

    return (
      <Fragment>
        <PanelWrapper>
          {knobKeysArray.length > 0 && knobKeysArray[0] !== '' ? (
            <TabsState>
              {knobKeysArray.map(groupId => (
                <div
                  id={groupId || DEFAULT_GROUP_ID}
                  key={groupId || DEFAULT_GROUP_ID}
                  title={groupId || DEFAULT_GROUP_ID}
                >
                  <TabWrapper key={groupId || DEFAULT_GROUP_ID} active={panelActive}>
                    <PropForm
                      knobs={Object.values(sorted[groupId])}
                      onFieldChange={this.handleChange}
                      onFieldClick={this.handleClick}
                    />
                  </TabWrapper>
                </div>
              ))}
            </TabsState>
          ) : (
            <PropForm
              knobs={Object.values(sorted[''])}
              onFieldChange={this.handleChange}
              onFieldClick={this.handleClick}
            />
          )}
        </PanelWrapper>
        <ActionBar
          actionItems={[
            { title: 'Copy', onClick: this.copy },
            { title: 'Reset', onClick: this.reset },
          ]}
        />
      </Fragment>
    );
  }
}

KnobPanel.propTypes = {
  active: PropTypes.bool.isRequired,
  onReset: PropTypes.object, // eslint-disable-line
  api: PropTypes.shape({
    on: PropTypes.func,
    getQueryParam: PropTypes.func,
    setQueryParams: PropTypes.func,
  }).isRequired,
};
