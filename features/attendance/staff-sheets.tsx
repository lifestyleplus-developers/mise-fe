import {
  classifyStaffError,
  serverMessage,
} from '@/features/attendance/staff-errors';
import {
  useCreateStaff,
  useEnrolStaff,
  useUpdateStaff,
} from '@/features/attendance/use-staff';
import type { Staff } from '@/shared/api/types';
import { ConfirmDialog } from '@/shared/components/confirm-dialog';
import { FormSheet } from '@/shared/components/form-sheet';
import type { OutletOption } from '@/shared/components/outlet-picker';
import { SwitchRow } from '@/shared/components/switch-row';
import { Banner } from '@/shared/components/ui/banner';
import { Button } from '@/shared/components/ui/button';
import { Text } from '@/shared/components/ui/text';
import { TextField } from '@/shared/components/ui/text-field';
import { format, useT } from '@/shared/i18n';
import { Archive, UserMinus } from 'lucide-react-native';
import * as React from 'react';
import { View } from 'react-native';

type SheetOutcome = {
  /** The platform said no; the screen checks whether the role is gone. */
  onForbidden: () => void;
  /** The module is off, or the person is gone. */
  onModuleOff: () => void;
  onSaved: (message: string) => void;
  onClose: () => void;
};

/** A name or code as typed: one line, no stray spaces at the ends. */
const oneLine = (value: string) => value.replace(/[\r\n]+/g, ' ');

type FieldsProps = {
  name: string;
  code: string;
  onName: (value: string) => void;
  onCode: (value: string) => void;
  outlets: readonly OutletOption[];
  on: Record<number, boolean>;
  onToggle: (outletId: number, value: boolean) => void;
  locked: boolean;
  failure: React.ReactNode;
};

/** Name, code and Works at: the same fields to add and to edit. */
function StaffFields({
  name,
  code,
  onName,
  onCode,
  outlets,
  on,
  onToggle,
  locked,
  failure,
}: FieldsProps) {
  const t = useT();
  return (
    <>
      {failure}
      <TextField
        label={t('att.name')}
        value={name}
        editable={!locked}
        onChangeText={(value) => onName(oneLine(value))}
        returnKeyType="next"
      />
      <View>
        <TextField
          label={t('att.code')}
          value={code}
          editable={!locked}
          autoCapitalize="characters"
          autoCorrect={false}
          onChangeText={onCode}
        />
        <Text className="text-muted-foreground mt-1 px-1 text-[12px] leading-snug">
          {t('att.code-hint')}
        </Text>
      </View>
      {outlets.length > 1 ? (
        <View accessibilityRole="radiogroup">
          <Text className="font-sans-semibold mb-1.5 text-[13px]">
            {t('att.works-at')}
          </Text>
          <View className="border-border overflow-hidden rounded-2xl border">
            {outlets.map((outlet, index) => (
              <View
                key={outlet.id}
                className={index > 0 ? 'border-border border-t' : undefined}
              >
                <SwitchRow
                  label={outlet.name}
                  checked={Boolean(on[outlet.id])}
                  disabled={locked}
                  onChange={(value) => onToggle(outlet.id, value)}
                />
              </View>
            ))}
          </View>
        </View>
      ) : null}
    </>
  );
}

function FailureBanner({ error }: { error: unknown }) {
  const t = useT();
  if (!error) return null;
  const kind = classifyStaffError(error);
  if (kind === 'rejected') {
    return <Banner tone="error" message={serverMessage(error) ?? ''} />;
  }
  if (kind === 'forbidden') {
    return <Banner tone="error" message={t('att.staff-forbidden')} />;
  }
  return (
    <Banner
      tone="error"
      message={`${t('admin.save-failed')} ${t('common.offline')}`}
    />
  );
}

/**
 * Where a failed save goes. A 403 keeps the sheet open with its reason: it may be
 * about this one person (they also work where the manager does not), and the screen
 * re-reads the list to find out whether the whole role has gone. A module that is off
 * leaves; anything else stays for another try.
 */
function routeFailure(error: unknown, outcome: SheetOutcome) {
  const kind = classifyStaffError(error);
  if (kind === 'forbidden') {
    outcome.onForbidden();
  } else if (kind === 'module-off') {
    outcome.onClose();
    outcome.onModuleOff();
  }
}

type AddStaffSheetProps = SheetOutcome & {
  visible: boolean;
  /** The outlet the roster is on; the new person starts there. */
  outletId: number;
  /** Outlets this person may enrol at. */
  outlets: readonly OutletOption[];
};

/** "Add staff": a name, an optional code, and where they work. */
export function AddStaffSheet({
  visible,
  outletId,
  outlets,
  ...outcome
}: AddStaffSheetProps) {
  const t = useT();
  const create = useCreateStaff();
  const [name, setName] = React.useState('');
  const [code, setCode] = React.useState('');
  const [on, setOn] = React.useState<Record<number, boolean>>({
    [outletId]: true,
  });

  function reset() {
    setName('');
    setCode('');
    setOn({ [outletId]: true });
    create.reset();
  }

  function close() {
    reset();
    outcome.onClose();
  }

  function save() {
    if (!name.trim() || create.isPending) return;
    // A single outlet is not asked about: the person works where the roster is.
    const chosen =
      outlets.length > 1
        ? outlets.filter((o) => on[o.id]).map((o) => o.id)
        : [outletId];
    create.mutate(
      {
        full_name: name.trim(),
        staff_code: code.trim() || null,
        outlet_ids: chosen,
      },
      {
        onSuccess: (person) => {
          outcome.onSaved(
            format(t('att.staff-added'), { name: person.full_name }),
          );
          close();
        },
        onError: (error) => routeFailure(error, { ...outcome, onClose: close }),
      },
    );
  }

  return (
    <FormSheet
      visible={visible}
      title={t('att.add-staff')}
      onClose={close}
      onSubmit={save}
      isSubmitting={create.isPending}
      submitDisabled={
        !name.trim() || (outlets.length > 1 && !Object.values(on).some(Boolean))
      }
    >
      <StaffFields
        name={name}
        code={code}
        onName={(value) => {
          setName(value);
          create.reset();
        }}
        onCode={(value) => {
          setCode(value);
          create.reset();
        }}
        outlets={outlets}
        on={on}
        onToggle={(id, value) =>
          setOn((current) => ({ ...current, [id]: value }))
        }
        locked={create.isPending}
        failure={<FailureBanner error={create.error} />}
      />
    </FormSheet>
  );
}

type EditStaffSheetProps = SheetOutcome & {
  person: Staff;
  /** Outlets this person may enrol at. */
  outlets: readonly OutletOption[];
  /** Administrators archive; a manager cannot. */
  canArchive: boolean;
};

/** A person's sheet: name, code, where they work, and Archive. Mounted while open. */
export function EditStaffSheet({
  person,
  outlets,
  canArchive,
  ...outcome
}: EditStaffSheetProps) {
  const t = useT();
  const update = useUpdateStaff(person.id);
  const enrol = useEnrolStaff(person.id);
  const [name, setName] = React.useState(person.full_name);
  const [code, setCode] = React.useState(person.staff_code ?? '');
  const activeAt = (outletId: number) =>
    person.outlets.some((o) => o.outlet_id === outletId && o.is_active);
  const [on, setOn] = React.useState<Record<number, boolean>>(() =>
    Object.fromEntries(outlets.map((o) => [o.id, activeAt(o.id)])),
  );
  const [confirming, setConfirming] = React.useState<'off' | 'archive' | null>(
    null,
  );

  const pending = update.isPending || enrol.isPending;
  const error = update.error ?? enrol.error;
  const takenOff = outlets.filter((o) => activeAt(o.id) && !on[o.id]);

  function reset() {
    update.reset();
    enrol.reset();
  }

  function fail(caught: unknown) {
    setConfirming(null);
    routeFailure(caught, outcome);
  }

  async function save() {
    if (!name.trim() || pending) return;
    try {
      const nextCode = code.trim() || null;
      if (name.trim() !== person.full_name || nextCode !== person.staff_code) {
        await update.mutateAsync({
          full_name: name.trim(),
          staff_code: nextCode,
        });
      }
      for (const outlet of outlets) {
        if (Boolean(on[outlet.id]) !== activeAt(outlet.id)) {
          await enrol.mutateAsync({
            outlet_id: outlet.id,
            is_active: Boolean(on[outlet.id]),
          });
        }
      }
      outcome.onSaved(format(t('att.staff-saved'), { name: name.trim() }));
      outcome.onClose();
    } catch (caught) {
      fail(caught);
    }
  }

  async function archive() {
    setConfirming(null);
    try {
      await update.mutateAsync({ is_archived: true });
      outcome.onSaved(format(t('att.staff-saved'), { name: person.full_name }));
      outcome.onClose();
    } catch (caught) {
      fail(caught);
    }
  }

  return (
    <>
      <FormSheet
        visible={confirming === null}
        title={person.full_name}
        onClose={outcome.onClose}
        onSubmit={() =>
          takenOff.length > 0 ? setConfirming('off') : void save()
        }
        isSubmitting={pending}
        submitDisabled={!name.trim()}
      >
        <StaffFields
          name={name}
          code={code}
          onName={(value) => {
            setName(value);
            reset();
          }}
          onCode={(value) => {
            setCode(value);
            reset();
          }}
          outlets={outlets}
          on={on}
          onToggle={(id, value) =>
            setOn((current) => ({ ...current, [id]: value }))
          }
          locked={pending}
          failure={<FailureBanner error={error} />}
        />
        {canArchive ? (
          <Button
            variant="outline"
            disabled={pending}
            className="border-destructive/50 w-full"
            onPress={() => setConfirming('archive')}
          >
            <Archive className="text-destructive-soft-foreground size-[18px]" />
            <Text className="text-destructive-soft-foreground font-sans-semibold text-[15px]">
              {t('att.archive')}
            </Text>
          </Button>
        ) : null}
      </FormSheet>

      <ConfirmDialog
        visible={confirming === 'off'}
        icon={UserMinus}
        tone="warning"
        title={format(t('att.take-off-title'), {
          name: person.full_name,
          outlet: takenOff[0]?.name ?? '',
        })}
        body={t('att.past-stays')}
        safe={{ label: t('admin.cancel'), onPress: () => setConfirming(null) }}
        other={{
          label: t('att.take-off'),
          onPress: () => {
            setConfirming(null);
            void save();
          },
        }}
      />
      <ConfirmDialog
        visible={confirming === 'archive'}
        icon={Archive}
        tone="warning"
        title={format(t('att.archive-title'), { name: person.full_name })}
        body={format(t('att.archive-body'), { name: person.full_name })}
        safe={{ label: t('admin.cancel'), onPress: () => setConfirming(null) }}
        other={{ label: t('att.archive'), onPress: () => void archive() }}
      />
    </>
  );
}
