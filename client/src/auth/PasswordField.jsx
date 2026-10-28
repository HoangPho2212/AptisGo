import { useState } from 'react';

import FormField from './FormField.jsx';

export default function PasswordField(props) {
  const [visible, setVisible] = useState(false);

  return (
    <FormField
      {...props}
      type={visible ? 'text' : 'password'}
      trailing={
        <button
          type="button"
          onClick={() => setVisible((current) => !current)}
          aria-label={visible ? 'Hide password' : 'Show password'}
          className="rounded-lg px-2 py-1 text-xs font-semibold text-teal-300 transition hover:bg-teal-400/10 hover:text-teal-200 focus-visible:ring-2 focus-visible:ring-teal-400/60 focus-visible:outline-none"
        >
          {visible ? 'Hide' : 'Show'}
        </button>
      }
    />
  );
}
