import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import toast from "react-hot-toast";
import { User, Mail, Phone } from "lucide-react";
import { getUser, updateUser } from "../../services/apiEndpoints";
import { setUser } from "../../store/slices/authSlice";
import ProfileHero from "../../components/profile/ProfileHero";
import { isPortalUser } from "../../utils/roleRoutes";

const ProfileEditPage = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { user: authUser, isAuthenticated } = useSelector((state) => state.auth);
  const userId = authUser?._id || authUser?.id;
  const fileInputRef = useRef(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: "",
    phone: "",
    avatar: "",
  });

  useEffect(() => {
    if (!isAuthenticated || !isPortalUser(authUser?.role)) {
      navigate("/login", { replace: true });
      return;
    }

    if (!userId) return;

    let isMounted = true;

    const loadProfile = async () => {
      try {
        const response = await getUser(userId);
        if (!isMounted) return;

        const data = response.data.data;
        setForm({
          name: data?.name || "",
          phone: data?.phone || "",
          avatar: data?.avatar || "",
        });
      } catch {
        if (isMounted) {
          setForm({
            name: authUser?.name || "",
            phone: authUser?.phone || "",
            avatar: authUser?.avatar || "",
          });
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    loadProfile();

    return () => {
      isMounted = false;
    };
  }, [authUser, isAuthenticated, navigate, userId]);

  const handleChange = (field) => (event) => {
    setForm((current) => ({ ...current, [field]: event.target.value }));
  };

  const handleAvatarSelect = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      setForm((current) => ({ ...current, avatar: String(reader.result || "") }));
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!userId) return;

    setSaving(true);

    try {
      const response = await updateUser(userId, {
        name: form.name,
        phone: form.phone,
        avatar: form.avatar || null,
      });

      const updated = response.data.data;
      const normalized = {
        ...updated,
        _id: updated._id || updated.id,
        id: updated._id || updated.id,
      };

      dispatch(setUser(normalized));
      localStorage.setItem("user", JSON.stringify(normalized));
      toast.success("Profile updated successfully");
      navigate("/customer/profile");
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to update profile");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto space-y-4">
        <div className="card overflow-hidden p-0 animate-pulse">
          <div className="h-48 bg-gray-200 dark:bg-gray-700" />
          <div className="px-6 pb-6 -mt-12">
            <div className="h-32 w-32 rounded-full bg-gray-300 dark:bg-gray-600" />
          </div>
        </div>
        <div className="card animate-pulse h-64" />
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-4xl mx-auto space-y-6">
      <ProfileHero
        name={form.name || authUser?.name}
        email={authUser?.email}
        avatar={form.avatar}
        role={authUser?.role}
        editable
        onEditPhoto={() => fileInputRef.current?.click()}
      />

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleAvatarSelect}
      />

      {form.avatar && (
        <div className="text-center sm:text-left -mt-2">
          <button
            type="button"
            onClick={() => setForm((current) => ({ ...current, avatar: "" }))}
            className="text-sm text-red-600 dark:text-red-400 hover:underline"
          >
            Remove profile photo
          </button>
        </div>
      )}

      <div className="card space-y-5">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
          Personal Information
        </h3>

        <div>
          <label
            htmlFor="edit-name"
            className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
          >
            Full Name
          </label>
          <div className="relative">
            <User
              className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
              size={20}
            />
            <input
              id="edit-name"
              type="text"
              value={form.name}
              onChange={handleChange("name")}
              className="input-field pl-10"
              placeholder="Your full name"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Email
          </label>
          <div className="relative">
            <Mail
              className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
              size={20}
            />
            <input
              type="email"
              value={authUser?.email || ""}
              readOnly
              className="input-field pl-10 bg-gray-100 dark:bg-gray-800 cursor-not-allowed"
            />
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            Email cannot be changed here.
          </p>
        </div>

        <div>
          <label
            htmlFor="edit-phone"
            className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
          >
            Phone Number
          </label>
          <div className="relative">
            <Phone
              className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
              size={20}
            />
            <input
              id="edit-phone"
              type="tel"
              value={form.phone}
              onChange={handleChange("phone")}
              className="input-field pl-10"
              placeholder="+1 (555) 000-0000"
            />
          </div>
        </div>
      </div>

      <div className="flex flex-wrap justify-end gap-3">
        <button
          type="button"
          onClick={() => navigate("/customer/profile")}
          disabled={saving}
          className="px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-800"
        >
          Cancel
        </button>
        <button type="submit" disabled={saving} className="btn-primary disabled:opacity-50">
          {saving ? "Saving..." : "Save Changes"}
        </button>
      </div>
    </form>
  );
};

export default ProfileEditPage;
