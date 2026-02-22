import React, { useState, useEffect } from 'react';
import { collection, addDoc, serverTimestamp, query, orderBy, onSnapshot, Timestamp } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../firebase';
import { useForm, Controller } from 'react-hook-form';

interface NotificationForm {
    title: string;
    body: string;
    scheduleOption: 'now' | 'later';
    scheduledDate: string;
    scheduledTime: string;
    recipeId: string;
}

interface NotificationDoc {
    id: string;
    title: string;
    body: string;
    imageUrl?: string;
    recipeId?: string;
    scheduledFor: Timestamp;
    createdAt: Timestamp;
    status: 'sent' | 'scheduled';
}

interface Recipe {
    id: string;
    title: string;
}

export function Notifications() {
    const [notifications, setNotifications] = useState<NotificationDoc[]>([]);
    const [recipes, setRecipes] = useState<Recipe[]>([]);
    const [imageFile, setImageFile] = useState<File | null>(null);
    const [imagePreview, setImagePreview] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const { control, handleSubmit, watch, reset } = useForm<NotificationForm>({
        defaultValues: {
            title: '',
            body: '',
            scheduleOption: 'now',
            scheduledDate: '',
            scheduledTime: '',
            recipeId: ''
        }
    });

    const scheduleOption = watch('scheduleOption');

    useEffect(() => {
        // Fetch recipes for dropdown
        const fetchRecipes = () => {
            const q = collection(db, 'recipes');
            const unsubscribe = onSnapshot(q, (snapshot) => {
                try {
                    const fetchedRecipes: Recipe[] = [];
                    snapshot.forEach((doc) => {
                        fetchedRecipes.push({ id: doc.id, title: doc.data().title || 'Untitled Recipe' });
                    });
                    setRecipes(fetchedRecipes);
                } catch (err) {
                    console.error('Error processing recipes snapshot', err);
                }
            }, (error) => {
                console.error("fetchRecipes onSnapshot error:", error);
            });
            return unsubscribe;
        };

        // Fetch notifications for history list
        const fetchNotifications = () => {
            const q = query(collection(db, 'notifications'), orderBy('createdAt', 'desc'));
            const unsubscribe = onSnapshot(q, (snapshot) => {
                try {
                    const fetched: NotificationDoc[] = [];
                    snapshot.forEach((doc) => {
                        const data = doc.data();

                        // Handle serverTimestamp which might be pending (null)
                        const scheduledFor = data.scheduledFor as Timestamp;
                        let status: 'sent' | 'scheduled' = 'sent';

                        if (scheduledFor && typeof scheduledFor.toDate === 'function') {
                            status = scheduledFor.toDate() <= new Date() ? 'sent' : 'scheduled';
                        }

                        fetched.push({
                            id: doc.id,
                            title: data.title || 'Untitled',
                            body: data.body || '',
                            imageUrl: data.imageUrl,
                            recipeId: data.recipeId,
                            scheduledFor: scheduledFor || Timestamp.now(), // Fallback if missing
                            createdAt: data.createdAt || Timestamp.now(),
                            status
                        });
                    });
                    setNotifications(fetched);
                } catch (err) {
                    console.error('Error processing notifications snapshot', err);
                }
            }, (error) => {
                console.error("fetchNotifications onSnapshot error:", error);
            });
            return unsubscribe;
        };

        const unsubRecipes = fetchRecipes();
        const unsubNotifications = fetchNotifications();

        return () => {
            unsubRecipes();
            unsubNotifications();
        };
    }, []);

    const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setImageFile(file);
            const reader = new FileReader();
            reader.onloadend = () => {
                setImagePreview(reader.result as string);
            };
            reader.readAsDataURL(file);
        }
    };

    const onSubmit = async (data: NotificationForm) => {
        setIsSubmitting(true);
        try {
            let imageUrl = '';
            if (imageFile) {
                const storageRef = ref(storage, `notifications/${Date.now()}_${imageFile.name}`);
                await uploadBytes(storageRef, imageFile);
                imageUrl = await getDownloadURL(storageRef);
            }

            let scheduledDateObj = new Date();
            if (data.scheduleOption === 'later' && data.scheduledDate && data.scheduledTime) {
                scheduledDateObj = new Date(`${data.scheduledDate}T${data.scheduledTime}`);
            }

            const notificationData = {
                title: data.title,
                body: data.body,
                scheduledFor: Timestamp.fromDate(scheduledDateObj),
                createdAt: serverTimestamp(),
                sender: 'Gastron',
                ...(imageUrl && { imageUrl }),
                ...(data.recipeId && { recipeId: data.recipeId })
            };

            await addDoc(collection(db, 'notifications'), notificationData);

            reset();
            setImageFile(null);
            setImagePreview(null);
            alert('Notification saved successfully!');

        } catch (error) {
            console.error('Error creating notification:', error);
            alert('Failed to send notification.');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="max-w-6xl mx-auto space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-2xl font-bold text-gray-900">Broadcast Notification</h1>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Composer Form */}
                <div className="bg-white rounded-lg shadow p-6">
                    <h2 className="text-lg font-semibold mb-4">Compose</h2>
                    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700">Title</label>
                            <Controller
                                name="title"
                                control={control}
                                rules={{ required: true }}
                                render={({ field }: { field: any }) => (
                                    <input
                                        {...field}
                                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring-primary sm:text-sm p-2 border"
                                        placeholder="E.g., New Recipe Alert!"
                                    />
                                )}
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700">Message Body</label>
                            <Controller
                                name="body"
                                control={control}
                                rules={{ required: true }}
                                render={({ field }: { field: any }) => (
                                    <textarea
                                        {...field}
                                        rows={4}
                                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring-primary sm:text-sm p-2 border"
                                        placeholder="Type your message here..."
                                    />
                                )}
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700">Attach Image (Optional)</label>
                            <input
                                type="file"
                                accept="image/*"
                                onChange={handleImageChange}
                                className="mt-1 block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-primary/10 file:text-primary hover:file:bg-primary/20"
                            />
                            {imagePreview && (
                                <img src={imagePreview} alt="Preview" className="mt-2 h-32 w-auto rounded-md object-cover" />
                            )}
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700">Link Recipe (Optional)</label>
                            <Controller
                                name="recipeId"
                                control={control}
                                render={({ field }: { field: any }) => (
                                    <select
                                        {...field}
                                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring-primary sm:text-sm p-2 border"
                                    >
                                        <option value="">None</option>
                                        {recipes.map((recipe) => (
                                            <option key={recipe.id} value={recipe.id}>
                                                {recipe.title}
                                            </option>
                                        ))}
                                    </select>
                                )}
                            />
                        </div>

                        <div className="border-t pt-4">
                            <label className="block text-sm font-medium text-gray-700 mb-2">Schedule</label>
                            <div className="flex items-center space-x-4">
                                <label className="flex items-center">
                                    <Controller
                                        name="scheduleOption"
                                        control={control}
                                        render={({ field }: { field: any }) => (
                                            <input
                                                type="radio"
                                                {...field}
                                                value="now"
                                                checked={field.value === 'now'}
                                                className="focus:ring-primary h-4 w-4 text-primary border-gray-300"
                                            />
                                        )}
                                    />
                                    <span className="ml-2 text-sm text-gray-700">Send Now</span>
                                </label>
                                <label className="flex items-center">
                                    <Controller
                                        name="scheduleOption"
                                        control={control}
                                        render={({ field }: { field: any }) => (
                                            <input
                                                type="radio"
                                                {...field}
                                                value="later"
                                                checked={field.value === 'later'}
                                                className="focus:ring-primary h-4 w-4 text-primary border-gray-300"
                                            />
                                        )}
                                    />
                                    <span className="ml-2 text-sm text-gray-700">Schedule for Later</span>
                                </label>
                            </div>

                            {scheduleOption === 'later' && (
                                <div className="mt-3 flex gap-4">
                                    <Controller
                                        name="scheduledDate"
                                        control={control}
                                        rules={{ required: scheduleOption === 'later' }}
                                        render={({ field }: { field: any }) => (
                                            <input
                                                type="date"
                                                {...field}
                                                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring-primary sm:text-sm p-2 border"
                                            />
                                        )}
                                    />
                                    <Controller
                                        name="scheduledTime"
                                        control={control}
                                        rules={{ required: scheduleOption === 'later' }}
                                        render={({ field }: { field: any }) => (
                                            <input
                                                type="time"
                                                {...field}
                                                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring-primary sm:text-sm p-2 border"
                                            />
                                        )}
                                    />
                                </div>
                            )}
                        </div>

                        <div className="pt-4">
                            <button
                                type="submit"
                                disabled={isSubmitting}
                                className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-[#1a1a1a] hover:bg-black focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-900 disabled:opacity-50"
                            >
                                {isSubmitting ? 'Sending...' : (scheduleOption === 'later' ? 'Schedule Notification' : 'Broadcast Now')}
                            </button>
                        </div>
                    </form>
                </div>

                {/* History List */}
                <div className="bg-white rounded-lg shadow p-6 max-h-[800px] overflow-y-auto">
                    <h2 className="text-lg font-semibold mb-4">Notification History</h2>
                    <div className="space-y-4">
                        {notifications.length === 0 ? (
                            <p className="text-sm text-gray-500">No notifications sent yet.</p>
                        ) : (
                            notifications.map((notif) => (
                                <div key={notif.id} className="border rounded-lg p-4 bg-gray-50">
                                    <div className="flex justify-between items-start mb-2">
                                        <h3 className="font-semibold text-gray-900">{notif.title}</h3>
                                        <span className={`text-xs px-2 py-1 rounded-full ${notif.status === 'sent' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
                                            {notif.status === 'sent' ? 'Sent' : 'Scheduled'}
                                        </span>
                                    </div>
                                    <p className="text-sm text-gray-600 mb-2">{notif.body}</p>
                                    {notif.imageUrl && (
                                        <img src={notif.imageUrl} alt="attached" className="h-20 w-auto rounded object-cover mb-2" />
                                    )}
                                    <div className="text-xs text-gray-500">
                                        {notif.status === 'scheduled' ? 'Scheduled for: ' : 'Sent at: '}
                                        {notif.scheduledFor.toDate().toLocaleString()}
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
