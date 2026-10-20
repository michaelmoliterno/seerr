import Button from '@app/components/Common/Button';
import Modal from '@app/components/Common/Modal';
import type { FilterOptions } from '@app/components/Discover/constants';
import useToasts from '@app/hooks/useToasts';
import { Permission, useUser } from '@app/hooks/useUser';
import defineMessages from '@app/utils/defineMessages';
import { filtersToQuery } from '@app/utils/discoverFilterQuery';
import { Transition } from '@headlessui/react';
import { RectangleStackIcon } from '@heroicons/react/24/solid';
import { DiscoverSliderType } from '@server/constants/discover';
import type DiscoverSlider from '@server/entity/DiscoverSlider';
import axios from 'axios';
import { Fragment, useState } from 'react';
import { useIntl } from 'react-intl';

const messages = defineMessages('components.Discover.SaveFilterSlider', {
  saveAsSlider: 'Save as Slider',
  saveAsSliderTip:
    'Adds a slider with these filters and sort order to the top of Discover.',
  sliderName: 'Slider Name',
  save: 'Add to Discover',
  saving: 'Adding…',
  success: 'Added "{title}" to Discover.',
  failure: 'Something went wrong while adding the slider.',
});

type SaveFilterSliderProps = {
  type: 'movie' | 'tv';
  filters: FilterOptions;
};

const SaveFilterSlider = ({ type, filters }: SaveFilterSliderProps) => {
  const intl = useIntl();
  const { addToast } = useToasts();
  const { hasPermission } = useUser();
  const [isOpen, setIsOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [title, setTitle] = useState('');

  const query = filtersToQuery(filters);

  // Sliders are global, so only admins can add them
  if (!hasPermission(Permission.ADMIN) || !query) {
    return null;
  }

  const save = async () => {
    setIsSaving(true);
    try {
      const { data: created } = await axios.post<DiscoverSlider>(
        '/api/v1/settings/discover/add',
        {
          type:
            type === 'movie'
              ? DiscoverSliderType.TMDB_MOVIE_FILTER
              : DiscoverSliderType.TMDB_TV_FILTER,
          title: title.trim(),
          data: query,
        }
      );

      // New sliders start disabled at the top; enable this one
      const { data: sliders } = await axios.get<DiscoverSlider[]>(
        '/api/v1/settings/discover'
      );
      await axios.post(
        '/api/v1/settings/discover',
        sliders.map((slider) =>
          slider.id === created.id ? { ...slider, enabled: true } : slider
        )
      );

      addToast(intl.formatMessage(messages.success, { title: title.trim() }), {
        appearance: 'success',
        autoDismiss: true,
      });
      setIsOpen(false);
      setTitle('');
    } catch {
      addToast(intl.formatMessage(messages.failure), {
        appearance: 'error',
        autoDismiss: true,
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <>
      <Transition
        as={Fragment}
        enter="transition-opacity duration-300"
        enterFrom="opacity-0"
        enterTo="opacity-100"
        leave="transition-opacity duration-300"
        leaveFrom="opacity-100"
        leaveTo="opacity-0"
        show={isOpen}
      >
        <Modal
          title={intl.formatMessage(messages.saveAsSlider)}
          subTitle={intl.formatMessage(messages.saveAsSliderTip)}
          okText={intl.formatMessage(
            isSaving ? messages.saving : messages.save
          )}
          okDisabled={isSaving || !title.trim()}
          onOk={() => save()}
          onCancel={() => setIsOpen(false)}
        >
          <input
            type="text"
            id="filterSliderTitle"
            aria-label={intl.formatMessage(messages.sliderName)}
            placeholder={intl.formatMessage(messages.sliderName)}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </Modal>
      </Transition>
      <div className="mb-2 flex flex-grow sm:mb-0 sm:ml-2 lg:flex-grow-0">
        <Button onClick={() => setIsOpen(true)} className="w-full">
          <RectangleStackIcon />
          <span>{intl.formatMessage(messages.saveAsSlider)}</span>
        </Button>
      </div>
    </>
  );
};

export default SaveFilterSlider;
