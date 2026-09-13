/**
 * RestaurantForm component for adding/editing restaurants
 */

import React from 'react';
import { useFormSubmission } from '@/hooks';
import {
  type CreateRestaurantSchema,
  createRestaurantSchema,
  getCuisineSelectOptions,
} from '@/lib/schemas';
import { m } from '@/paraglide/messages';
import { COMMON, RESTAURANT, RESTAURANT_FORM } from '@/test/test-ids';
import { RestaurantForm as RestaurantFormData } from '../../types';
import { Button } from '../ui/button';
import { DialogFooter } from '../ui/dialog';
import { Form, FormSubmit } from '../ui/form';
import { FormInput, FormSelect, FormTextarea } from '../ui/form-fields';

interface RestaurantFormProps {
  onClose: () => void;
  onSubmit: (data: RestaurantFormData) => Promise<void>;
  initialData?: Partial<RestaurantFormData>;
}

export const RestaurantForm: React.FC<RestaurantFormProps> = ({
  onClose,
  onSubmit,
  initialData,
}) => {
  const isEditing = Boolean(initialData);

  const { isSubmitting, handleSubmit } = useFormSubmission({
    onSuccess: () => onClose(),
    successTitle: isEditing ? m.restaurant_form_updatedTitle() : m.restaurant_form_addedTitle(),
    successMessage: isEditing
      ? m.restaurant_form_updatedMessage()
      : m.restaurant_form_addedMessage(),
    errorTitle: isEditing ? m.restaurant_form_updateFailed() : m.restaurant_form_addFailed(),
  });

  const handleFormSubmit = async (values: CreateRestaurantSchema) => {
    await handleSubmit(
      () => onSubmit(values),
      isEditing
        ? m.restaurant_toast_updated({ name: values.name })
        : m.restaurant_toast_added({ name: values.name })
    );
  };

  const validateName = ({ value }: { value: string }) => {
    const result = createRestaurantSchema.shape.name.safeParse(value);
    return result.success ? undefined : result.error.issues[0]?.message;
  };

  const validateAddress = ({ value }: { value: string }) => {
    const result = createRestaurantSchema.shape.address.safeParse(value);
    return result.success ? undefined : result.error.issues[0]?.message;
  };

  return (
    <Form<CreateRestaurantSchema>
      defaultValues={{
        name: initialData?.name || '',
        address: initialData?.address || '',
        cuisine: initialData?.cuisine || undefined,
        notes: initialData?.notes || '',
      }}
      onSubmit={handleFormSubmit}
    >
      <div className="grid gap-4 py-4">
        <FormInput
          name="name"
          label="Restaurant Name"
          placeholder="Enter restaurant name"
          required
          validate={validateName}
          data-testid={RESTAURANT_FORM.NAME_INPUT}
        />

        <FormInput
          name="address"
          label="Address"
          placeholder="Enter restaurant address"
          required
          validate={validateAddress}
          data-testid={RESTAURANT_FORM.ADDRESS_INPUT}
        />

        <FormSelect
          name="cuisine"
          label="Cuisine"
          placeholder={m.restaurant_form_placeholder_cuisine()}
          options={getCuisineSelectOptions()}
          data-testid={RESTAURANT_FORM.CUISINE_INPUT}
        />

        <FormTextarea
          name="notes"
          label="Notes"
          placeholder="Any additional notes about this restaurant"
          rows={3}
          data-testid={RESTAURANT_FORM.NOTES_INPUT}
        />
      </div>

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose} data-testid={COMMON.CANCEL_BTN}>
          Cancel
        </Button>
        <FormSubmit disabled={isSubmitting} data-testid={RESTAURANT.ADD_RESTAURANT_BTN}>
          {isEditing ? 'Update Restaurant' : 'Add Restaurant'}
        </FormSubmit>
      </DialogFooter>
    </Form>
  );
};
